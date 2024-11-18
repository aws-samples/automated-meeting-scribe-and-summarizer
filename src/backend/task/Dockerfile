
FROM public.ecr.aws/docker/library/python:3.12
USER root
WORKDIR /srv
COPY . /srv

RUN pip3 install --upgrade pip && \
    pip3 install -r requirements.txt
RUN playwright install --with-deps chromium

RUN apt-get update && \
    apt-get install -y \
    ffmpeg \
    pulseaudio

RUN chmod +x /srv/entry.sh
ENTRYPOINT ["/srv/entry.sh"]
