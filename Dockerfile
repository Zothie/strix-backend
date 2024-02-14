FROM node:20.10.0

# Create app directory
WORKDIR /app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm install
# If you are building your code for production
# RUN npm install --only=production

# Bundle app source
COPY . .

COPY ./docker-entrypoint.sh .
RUN ["chmod", "+x", "./docker-entrypoint.sh"]

EXPOSE 3000
# To be able to pass parameters (e.g.: override configuration)
ENTRYPOINT ["./docker-entrypoint.sh"]
