// modules
const Storage    = require('node-storage');
const store      = new Storage('./storage');
const { Mongo }  = require('./mongo');
const { logger } = require('./log');
const logExcp    = require('./log').exceptions;
const { Httpd, Request } = require('./httpd');
const env = require('./config/env.json');
const sleep = require('system-sleep');
const ProgressBar = require('progress');
// exceptions
function NoOptionsProvidedException(){
  this.level    = 'ShowStopper';
  this.message  = 'No options provided';
}
function NoTypesProvidedException(){
  this.level    = 'ShowStopper';
  this.message  = 'No type provided';
 }
 const exceptions =  {
   'NoOptionsProvidedException': NoOptionsProvidedException,
   'NoTypesProvidedException': NoTypesProvidedException
 };

function Es(env, logLevel){
  let l;
  const output = {
    type: 'file',
    name: '/tmp/esindex.log'
  };
  const logOptions = {
    outputs: [

    ],
    type: 'file',
    level: logLevel,
    label: 'Elastic'
  };

  try {
    l = logger(logOptions);
  } catch (err){
    console.log(err);
  }

  // hold environment key
  this.env       = env;
  // holds communication keys of invalid documents
  this.invalidCKs = [];
  // batchsize chunks the total amount of requests per loop
  this.batchsize = 10;
  // holds the relevant index name
  this.index     = 'artikel_konstrukt';
  // holds the elastic search search endpoint
  this.search    = '_search';
  // holds the base json payload for queries to elastic search
  this.query     = {
    "query": {
      "match": {}
    }
  };
  // logger holds winston log instance
  this.logger = l;
  // holds type specific data
  this.typeMap = {
    articles: {
      collection: 'artikel',
      storeIndex: 'deletedArticles'
    },
    products: {
      collection: 'produkt',
      storeIndex: 'deletedProducts',
    }
  };
}

Es.prototype.checkIndex = function (options){
  if (!options){
    throw new NoOptionsProvidedException();
  }
  if (!options.types){
    throw new NoTypesProvidedException();
  }
  let uri = env[this.env].es + "/" + this.index + "/" + this.search;

  for (let i = 0; i < options.types.length; i++){
    let type = options.types[i];
    this.logger.info({type: type, msg: 'checking for invalid documents'});
    switch (true){
      case (options.articles):
        this.logger.info({msg: 'artikel auf gehts'});
        switch (true) {
          case (options.file):
            this.logger.info({msg: 'file auf gehts'});
            break;
          default:
            this.logger.info({msg: 'storage auf gehts'});
            let idx = this.typeMap[type].storeIndex;
            if (!store.get(idx)) {
              this.logger.info({
                key: idx,
                msg: 'no data in storage... querying mongo first'
              });
              try {
                new Mongo(this.env, this.logger.level).getDeleted(options);
              } catch (err) {
                switch (err.constructor) {
                  case logExcp.UnknownLevelException:
                  case logExcp.NoLogfilePathException:
                  case logExcp.NoOutputTypeException:
                  case logExcp.UnknownOutputTypeException:
                  case logExcp.NoOptionsProvidedException:
                    console.error(err.message);
                    break;
                  default:
                    console.error(err);
                    break;
                }
              }
            }
            // do requests to elastic search
            let host = env[this.env].es;

            this.logger.verbose({msg: 'preparing progress bar'});
            let bar = new ProgressBar('checking [:bar] :current/:total :percent :eta/eta',{
              complete: '=',
              incomplete: ' ',
              width: 20,
              total: store.get(idx).length
            });

            this.logger.verbose({host: host, count: store.get(idx).length, msg: 'preparing requests'});
            for (let i = 0; i < store.get(idx).length; i += this.batchsize){
              // do requests in batches to avoid spamming elastic search host
              let batch = store.get(idx).slice(i, i + this.batchsize);
              for (let bi = 0; bi < batch.length; bi++){
                this.query.query.match['artikel.communicationkey'] = batch[bi];
                Httpd.Do(
                    Request('POST', uri, this.query)
                ).then(response => {
                    if (response.hits.total !== 0){
                      this.logger.info({type: type, ck: batch[bi], msg: 'invalid document found'});
                      this.invalidCKs.push(batch[bi]);
                    }
                  }).catch(err => {
                    this.logger.error({host: host, err: err, msg: 'error at request against elastic search host'});
                  });
                // update progress bar
                bar.tick({'current': bi + i});
              }
              // let elastic search catch its breath
              sleep(250);
            }
            this.logger.info({count: this.invalidCKs, msg: 'count of invalid documents'});
          break;
        }
        break;
      case (options.products):
        this.logger.info({msg: 'produkt auf gehts'});
        switch (true){
          case (options.file):
            this.logger.info({msg: 'file auf gehts'});
            break;
          default:
            this.logger.info({msg: 'storage auf gehts'});
            let idx = this.typeMap[type].storeIndex;
            if (!store.get(idx)) {
              this.logger.info({key: idx, msg: 'no data in storage... querying mongo' });
              try {
                new Mongo(this.env, this.logger.level).getDeleted(options);
              } catch(err) {
                switch (err.constructor){
                  case logExcp.UnknownLevelException:
                  case logExcp.NoLogfilePathException:
                  case logExcp.NoOutputTypeException:
                  case logExcp.UnknownOutputTypeException:
                  case logExcp.NoOptionsProvidedException:
                    console.error(err.message);
                    break;
                  default:
                    console.error(err);
                    break;
                }
              }
            }
            break;
        }
        break;
    }
  }
};

Es.prototype.deleteIndex = function (options){

};

Es.prototype.doRequest = function(){

};

module.exports = { Es, exceptions };

