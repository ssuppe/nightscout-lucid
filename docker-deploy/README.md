# Deploying Nightscout Lucid with Docker

## Prerequisites

- Docker / [Docker Desktop](https://docs.docker.com/) installed with command-line access

- **Dockerfile**

  Used to build the Nightscout Lucid Docker image.

- **docker-compose.yml**

  Docker Compose file for building and running the Docker container.

- **nightscout-lucid.env**

  Application environment variable definitions.

- **Caddyfile.prod**

  Application Caddy production file (copy from the main GitHub repository).

## Use

Update the following files for your use:

- **nightscout-lucid.env** (environment parameters)

- **docker-compose.yml**

  Adapt the image reference to either a local image or optional an image in your Docker repository (e.g. on Docker Hub)

### Running the application service

- Start:

      docker compose up -d

- Stop:

      docker compose down

- Update to latest online docker image version (when docker-compose.yml references an online image):

      docker compose pull
      docker compose restart

Once the service is running you can open the web application at http://localhost:8120

# Building the Docker image

1. Make sure Docker is installed on your system. From the command line, try running `docker system`.

2. Clone this repository and build the image:

    ```
    git clone https://github.com/ssuppe/nightscout-lucid
    ```

    Optionally, update the local version of `Caddyfile.prod` with a more recent version from the repository:

    ```
    cd docker-deploy
    cp ../Caddyfile.prod .
    ```

3. Build the image:

    ```
    cd nightscout-lucid/docker-deploy
    docker compose build --no-cache
    ```

    Any build errors will show here.

4. Test the application:

    ```
    docker compose up -d
    ```

    Then open your browser at http://localhost:8120/

5. *Optional*: Push the image to your docker image repository

    ```
    image: 'myreponame/nightscout-lucid:latest'
    ```

    To push the image:

    ```
    docker compose push
    ```

    Note: You will need to log in to Docker for this.

Remark:
By default this will build a Docker image based on your build environment's hardware platform. For example, when building the Docker image on Intel hardware (x86-64), the resulting Docker image will run on a MacBook Pro (x86-64) but may not run on a MacBook Air (ARM64).

**Remarks:**

```
pull_policy: if_not_present
```

On startup, Docker Compose will first search for the referenced Docker image. If the referenced image is not local, it will be automatically downloaded.

If the referenced image cannot be found, Docker Compose will try to build it. This will fail when this `docker-deploy` directory is not part of the local `nightscout-lucid` Git repository clone.

For testing, you can remove the local Docker image using:

```
docker images
docker rmi <imageID>
```

# Stand-alone deployment

To deploy the application, copy the `docker-deploy` directory to your hosting device. This can be any device supporting Docker, such as a Synology NAS, a Raspberry Pi, Windows/WSL2+Ubuntu, a locally running VM, or a cloud host supporting Docker Compose deployments.

## Deployment & Installation

Before installing the stand-alone version the **Docker image** should be available in the online Docker repository (e.g. Docker Hub):
Double-check the image reference in the docker-compose.yml.

1. Copy the content of the `docker-deploy` directory (or use the `*release*.zip` file) to the hosting device.
2. Check the `image:` reference in `docker-compose.yml`.
3. Change the `NURSE_*` environment variable definitions in `nightscout-lucid.env` to your needs.
4. Optional: Log in to Docker with your Docker account (`docker login`).

With the above, you should be able to start the application container using the Docker CLI command `docker compose up -d`.

With the above, the application is available at http://localhost:8120/. From there, configure your hosting device to make the application available on your network.

## Debug and testing tips

1. Run the container from the command line without detaching by leaving out the `-d` argument. This enables you to trace the running container's serial output. Any startup errors will also show here.

    ```
    # CLI command:
    docker compose
    ```

2. Log in to a running Docker container:

    ```
    # CLI command:
    docker exec -it <container-name> /bin/sh
    ```

   This will get you to the internal shell prompt of the running container instance.

## Related

- [Docker Desktop](https://docs.docker.com/)  -> Install Docker
- [Docker Hub](https://hub.docker.com/)       -> Deploy Docker image to the Docker Hub repository
