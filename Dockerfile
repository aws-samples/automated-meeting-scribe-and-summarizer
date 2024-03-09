
FROM public.ecr.aws/docker/library/python:3.12
USER root
WORKDIR /srv
COPY . /srv

# Install Chrome Browser
RUN curl -sS -o - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add -
RUN echo "deb http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list
RUN apt-get -y update
RUN apt-get -y install google-chrome-stable

RUN pip install --upgrade pip
RUN pip install -r requirements.txt
ENTRYPOINT [ "python3","scribe.py" ]
