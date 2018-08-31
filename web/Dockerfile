FROM node:8.11.1-alpine

WORKDIR /app

COPY ./runtime/* /app/
# COPY ./src/* /app/src
RUN \
  npm install -g gulp bower polymer-cli --unsafe-perm generator-polymer-init-custom-build && \
  npm install

ENV PATH /node_modules/.bin:$PATH

ARG NODE_ENV=production
ENV NODE_ENV ${NODE_ENV}

EXPOSE 9229 8080

RUN chmod +x /app/docker-entrypoint.sh

ENTRYPOINT ["/app/docker-entrypoint.sh"]

CMD ["start"]
# RG
