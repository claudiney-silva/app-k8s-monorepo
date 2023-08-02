# Cluster EKS com eksctl

## Create AWS Resources

```
# Certificate
aws acm request-certificate --domain-name codeonline.click \
                            --validation-method DNS \
                            --idempotency-token 91adc45q \
                            --region sa-east-1 \
                            --tags Key=project,Value=codeonline \
                            --subject-alternative-names *.codeonline.click

#arn:aws:acm:sa-east-1:<ACCOUNT-NUMBER>:certificate/8298cc75-0cb3-4d29-b92c-988a73bd4f1a

# Entrar na console da AWS e validar os certificados


# Criando policy para o External DNS
aws iam create-policy \
  --policy-name AllowExternalDNSUpdates \
  --policy-document file://aws/external_dns_iam_policy.json

#arn:aws:iam::<ACCOUNT-NUMBER>:policy/AllowExternalDNSUpdates  

# Create EC2 Keypair
aws ec2 create-key-pair --key-name codeonline-keypair \
                        --query 'KeyMaterial' \
                        --region sa-east-1 \
                        --output text > codeonline-keypair.pem

mv codeonline-keypair.pem ~/
```

## Create EKS Cluster using eksctl

```
# Create cluster
eksctl create cluster --name=codeonline-cluster \
                      --region=sa-east-1 \
                      --zones=sa-east-1a,sa-east-1b,sa-east-1c \
                      --tags project=codeonline
                      --without-nodegroup 

# Get List of clusters
eksctl get cluster

# Delete cluster
eksctl delete cluster --name=codeonline-cluster
```

## Create & Associate IAM OIDC Provider for our EKS Cluster

To enable and use AWS IAM roles for Kubernetes service accounts on our EKS cluster, we must create & associate OIDC identity provider.

```
eksctl utils associate-iam-oidc-provider \
    --region sa-east-1 \
    --cluster codeonline-cluster \
    --approve
```

## Create EKS Node Group in Private Subnets

```
# Create nodegroup
eksctl create nodegroup --cluster=codeonline-cluster \
                        --region=sa-east-1 \
                        --tags project=codeonline \
                        --name=codeonline-ng-api \
                        --node-type=t3.medium \
                        --nodes-min=2 \
                        --nodes-max=4 \
                        --node-volume-size=20 \
                        --ssh-access \
                        --ssh-public-key=codeonline-keypair \
                        --managed \
                        --asg-access \
                        --external-dns-access \
                        --full-ecr-access \
                        --appmesh-access \
                        --alb-ingress-access \
                        --node-private-networking

eksctl set labels --cluster codeonline-cluster \
                  --nodegroup codeonline-ng-api \
                  --labels codeonline/namespace=api,codeonline/role=worker

kubectl get nodes -o wide

# Login no worker node: For MAC or Linux (Neste caso, não tem IP Público)
ssh -i codeonline-keypair.pem ec2-user@<Public-IP-of-Worker-Node>

# Get NodeGroups in a EKS Cluster
eksctl get nodegroup --cluster=codeonline-cluster

# Delete Node Group - Replace nodegroup name and cluster name
eksctl delete nodegroup codeonline-ng-api --cluster codeonline-cluster
```

## Criando o Load Balancer Service Controller

### Policy for service account

```
#Download de latest IAM Policy
curl -o iam_policy_latest.json https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/main/docs/install/iam_policy.json

# Create IAM Policy using policy downloaded 
aws iam create-policy \
    --policy-name AWSLoadBalancerControllerIAMPolicy \
    --policy-document file://iam_policy_latest.json
```

Make note of IAM Policy `arn:aws:iam::<ACCOUNT-NUMBER>:policy/AWSLoadBalancerControllerIAMPolicy`.

### Create an IAM role for the AWS LoadBalancer Controller and attach the role to the Kubernetes service account
```
eksctl create iamserviceaccount \
  --cluster=codeonline-cluster \
  --namespace=kube-system \
  --name=aws-load-balancer-controller \
  --tags project=codeonline \
  --attach-policy-arn=arn:aws:iam::<ACCOUNT-NUMBER>:policy/AWSLoadBalancerControllerIAMPolicy \
  --override-existing-serviceaccounts \
  --approve

# Get IAM Service Account
eksctl get iamserviceaccount --cluster codeonline-cluster

# Verify if any existing service account
kubectl get sa -n kube-system
kubectl get sa aws-load-balancer-controller -n kube-system
```

### Install the AWS Load Balancer Controller using Helm V3

```
# Add the eks-charts repository.
helm repo add eks https://aws.github.io/eks-charts

# Update your local repo to make sure that you have the most recent charts.
helm repo update

## REVISAR A VPC-ID ANTES DE INSTALAR O HELM

# https://docs.aws.amazon.com/eks/latest/userguide/add-ons-images.html
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=codeonline-cluster \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller \
  --set region=sa-east-1 \
  --set vpcId=vpc-0a0d8ee19f623ec02 \
  --set image.repository=602401143452.dkr.ecr.sa-east-1.amazonaws.com/amazon/aws-load-balancer-controller
```

### Verify

```
# Verify that the controller is installed.
kubectl -n kube-system get deployment 
kubectl -n kube-system get deployment aws-load-balancer-controller
kubectl -n kube-system describe deployment aws-load-balancer-controller

# Verify AWS Load Balancer Controller Webhook service created
kubectl -n kube-system get svc 
kubectl -n kube-system get svc aws-load-balancer-webhook-service
kubectl -n kube-system describe svc aws-load-balancer-webhook-service
```

### Unistall helm

```
# Uninstall AWS Load Balancer Controller
helm uninstall aws-load-balancer-controller -n kube-system 
```

## Criando o External DNS: Used for Updating Route53 RecordSets from Kubernetes

```
# Create IAM Role, k8s Service Account & Associate IAM Policy
eksctl create iamserviceaccount \
    --name external-dns \
    --namespace default \
    --cluster codeonline-cluster \
    --attach-policy-arn arn:aws:iam::<ACCOUNT-NUMBER>:policy/AllowExternalDNSUpdates \
    --approve \
    --override-existing-serviceaccounts

    #--domain-filter=codeonline.click # will make ExternalDNS see only the hosted zones matching provided domain, omit to process all available hosted zones
    #--policy=upsert-only # would prevent ExternalDNS from deleting any records, omit to enable full synchronization    

# Verify
# List Service Account
kubectl get sa external-dns

# Describe Service Account
kubectl describe sa external-dns

#Observation: 
#1. Verify the Annotations and you should see the IAM Role is present on the Service A
```

## Deploy

```
# Creating resources
kubectl apply -f k8s/resources

# Verify Deployment by checking logs
kubectl logs -f $(kubectl get po | egrep -o 'external-dns[A-Za-z0-9-]+')

# Creating apis
kubectl apply -f k8s/api --recursive --namespace=api

# Creating auth
kubectl apply -f k8s/auth/ --namespace=auth
```