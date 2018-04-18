const { ina } = require("./helper");
const fetch   = require("node-fetch");

function InvalidHttpMethodException(method){
  this.level    = 'ShowStopper';
  this.message  = `Invalid method: ${method}`;
}

const exceptions = {
  'InvalidHttpMethodException': InvalidHttpMethodException
};

function Httpd(){}

Httpd.Do = async function(req){
  return await (await fetch(req.uri, {
    method: req.method,
    body:   req.payload
  })).json();
};

function Request(method, uri, payload){
  this.validMethods = ['POST'];
  try {
    this.method = parseMethod(this.validMethods, method);
  } catch(err){
    console.log(err);
    throw new err.constructor(method);
  }
  this.uri = parseUri(uri);
  this.payload = parsePayload(payload);

  return {method: this.method, uri: this.uri, payload: this.payload};
}

function parseMethod(validMethods, method){
  if ( ! ina( validMethods, method.toUpperCase() ) ){
    throw new InvalidHttpMethodException(method);
  }
  return method.toUpperCase()
}

function parseUri(uri){
  if ( ! uri.includes("http://") ){
    return "http://" + uri;
  }
  return uri
}

function parsePayload(payload){
  return JSON.stringify(payload);
}

module.exports = {
  Httpd,
  Request,
  exceptions
};