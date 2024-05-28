
FROM public.ecr.aws/docker/library/python:3.12
USER root
WORKDIR /srv
COPY . /srv

RUN apt update
RUN apt upgrade -y
RUN pip3 install --upgrade pip
RUN pip3 install -r requirements.txt
RUN playwright install --with-deps
RUN apt install pulseaudio -y

RUN chmod +x entrypoint.sh
ENTRYPOINT ["entrypoint.sh"]
