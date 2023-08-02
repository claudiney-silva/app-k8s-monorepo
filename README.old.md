# app-k8s-monorepo

## Terraform

```shell
cd terraform
terraform init
terraform plan
terraform apply
terraform destroy
```

## App Blog

```shell
cd apps\blog\
docker build . -t claudineysilva/app-k8s-monorepo-blog:1
docker tag claudineysilva/app-k8s-monorepo-blog:1 claudineysilva/app-k8s-monorepo-blog:latest
docker run -d -p 3000:3000 claudineysilva/app-k8s-monorepo-blog:1
docker images | grep claudineysilva
docker login
docker push claudineysilva/app-k8s-monorepo-blog:1
docker push claudineysilva/app-k8s-monorepo-blog:latest
```

## Kubeclt

```
aws eks update-kubeconfig --name app-k8s-monorepo-eks
```

## AWS Ingress Controller

```
helm repo add aws https://aws.github.io/eks-charts
helm repo update
helm upgrade -i -n ingress-aws --create-namespace ingress-aws aws/aws-load-balancer-controller -f aws-load-balancer-values.yaml --version 1.4.3

helm upgrade aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n ingress-aws \
  -set clusterName=app-k8s-monorepo-eks \
  -set serviceAccount.create=false \
  -set serviceAccount.name=aws-load-balancer-controller


helm upgrade aws-load-balancer-controller eks/aws-load-balancer-controller \
  --install \
  --version 1.2.7 \
  --namespace kube-system
```




helm install -n ingress-aws --create-namespace aws-load-balancer-controller-crds aws-load-balancer-controller-crds/aws-load-balancer-controller-crds --version 1.3.3



helm install aws-load-balancer-controller eks/aws-load-balancer-controller -n kube-system --set clusterName=<your-cluster-name> --set serviceAccount.create=false --set serviceAccount.name=aws-load-balancer-controller

```



helm upgrade -i -n ingress-aws --create-namespace ingress-aws aws/aws-load-balancer-controller -f aws-load-balancer-values.yaml --version 1.4.3

# At the time of creating this gist, the Chart doesn't provide `controller.ingressClassResource.default` value
# the name `aws-alb` below is coming from the values file: https://gist.github.com/meysam81/d7d630b2c7e8075270c1319f16792fe2
kubectl annotate ingressclasses aws-alb ingressclass.kubernetes.io/is-default-class=true
