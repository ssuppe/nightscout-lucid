#!/bin/bash

# Push container image to docker image repository (e.g: https://hub.docker.com/)
# Make sure to update image reference in your docker-compose.yaml:
#   image: '<your_image_repositoryname>/nightscout-lucid:latest'

# docker-compose push
docker compose push
