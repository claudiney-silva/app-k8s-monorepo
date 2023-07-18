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