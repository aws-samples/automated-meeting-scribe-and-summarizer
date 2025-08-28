
FROM public.ecr.aws/docker/library/node:20-slim
USER root
WORKDIR /srv
COPY . /srv

RUN npm install && \
    npm run build
RUN npx playwright install --with-deps --only-shell

RUN apt-get update && \
    apt-get install -y \
    ffmpeg \
    pulseaudio

RUN chmod +x /srv/entry.sh
ENTRYPOINT ["/srv/entry.sh"]
