// modules
const mongoClient   = require('mongodb').MongoClient;
const fs            = require('node-fs');
const Storage       = require('node-storage');
const store         = new Storage('./storage');
const sleep         = require('system-sleep');
const { logger }    = require('./log');

// holds mongo and elastic search hosts for different environments
const config        = require('./config/env');

function Mongo(env, logLevel){
  // init logger instance
  let l;
  const output = {
    type: 'file',
    nanme: '/tmp/esindex.log'
  };
  const logOptions = {
    outputs: [

        ],
    type: 'file',
    level: logLevel
  };

  try {
    l = logger(logOptions);
  } catch (err){
    console.log(err);
  }

  // holds environment key
  this.env = env;
  // holds communication keys of articles that are marked deleted
  this.delArticles = [];
  // holds communication keys of products that are marked deleted
  this.delProducts = [];
  // holds mongodb.MongoClient
  this.client = mongoClient;
  // logger
  this.logger = l;
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

/**
 * Wraps call to save communication keys according to their type
 *
 * @param {string} type -  Can be either 'articles' or 'products'
 * @param {string} ck - The communication key that will be added to according array
 */
Mongo.prototype.addCk = function(type, ck){
  switch (type){
    case "articles":
      this.delArticles.push(ck);
      break;
    case "products":
      this.delProducts.push(ck);
      break;
  }
};

Mongo.prototype.getCk = function(type){
  switch (type){
    case "articles":
      return this.delArticles;
    case "products":
      return this.delProducts;
  }
};

Mongo.prototype.getDeleted = function(options){
  const q = {'istgeloescht':true};
  const host = config[this.env].mongo;
  this.logger.verbose({host: host, msg: 'connecting to mongo host'});
  this.client.connect(host, (err, db) => {
    if (err) {
      this.logger.error({host: host, err: err, msg: 'error at this.client.connect()'});
      throw err;
    }
    this.logger.info({host: host, msg: 'connected!'});
    const stammdaten = db.db('stammdaten');
    this.logger.verbose({host: host, db: 'stammdaten', msg: 'using database'});
    for (let i = 0; i < options.types.length; i++){
      let type = options.types[i];
      let coll = this.typeMap[type].collection;
      this.logger.info({host: host, db: 'stammdaten', collection: coll, query: q});
      stammdaten.collection(coll).find(q).toArray().then( documents => {
        for (let i = 0; i < documents.length; i++){
          let ck = documents[i].communicationkey;
          this.logger.verbose({type:'article', ck: ck, msg: 'comkey marked deleted found'});
          this.addCk(type, ck);
        }
        this.logger.info({type: type, count: this.getCk(type).length, msg: 'deleted comkeys found'});
        db.close();
        this.logger.info({host: host, msg: 'closed connection to database'});
        // save to storage
        if (!options.hasOwnProperty('file') && this.getCk(type).length > 0){
          this.logger.info({msg: 'saving results to local storage'});
          store.put(this.typeMap[type].storeIndex, this.getCk(type));
          while(store.queue.length() !== 0){
            sleep(250);
          }
          this.logger.info({msg: 'done saving'});
          process.exit(0);
        }
        // exit, if there is nothing to be saved
        if (this.getCk(type).length === 0){
          this.logger.info({msg: 'nothing to save'});
          process.exit(0);
        }
        // save to file
        this.logger.info({type: type, file: options.file, msg: 'saving comkeys to file'});
        let fd = fs.openSync(options.file, 'w');
        for (let i = 0; i < this.getCk(type).length; i++){
          try {
            fs.appendFileSync(options.file, this.getCk(type)[i] + '\n')
            this.logger.verbose({type: type, file: options.file, msg: 'appending comkey to file'});
          } catch (err){
            console.error(err);
          }
        }
        this.logger.info({type: type, file: options.file, msg: 'done saving to file'});
        try {
          fs.closeSync(fd);
        } catch (err){
          this.logger.error({err: err, msg: 'error at fs.closeSync(fd)'});
        }
      }).catch( err => {
        this.logger.error({err: err, msg: 'error at stammdaten.collection().find().toArray()'});
      });
    }
  });
};

module.exports = { Mongo };














