#!/bin/bash

# Push container image to docker image repository (e.g: https://hub.docker.com/)
# Make sure to change image refernce in your docker-compose.yaml:
# image: '<registry name>/nightscout-lucid:latest'

# docker-compose push
docker compose push
