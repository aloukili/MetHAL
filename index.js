'use strict';
const axios = require('axios');
const { Readable } = require('stream');
const querystring = require('querystring');

/**
 * Build a (sub)query string from search options
 * @param  {Object} options  search options
 * @param  {String} operator operator to use between options, ie. AND/OR
 * @return {String}          solr compliant query string
 */
function buildQuery (search, operator) {
  search = search || {};
  operator = operator || 'AND';

  const parts = [];
  let negation; // NOT subquery

  if (Array.isArray(search)) {
    search.forEach(function (subquery) {
      const part = buildQuery(subquery, 'AND');
      if (part) { parts.push(part); }
    });
  } else {
    let subquery;

    for (const p in search) {
      switch (p) {
        case '$or':
          subquery = buildQuery(search[p], 'OR');
          if (subquery) parts.push(subquery);
          break;
        case '$and':
          subquery = buildQuery(search[p], 'AND');
          if (subquery) parts.push(subquery);
          break;
        case '$not':
          subquery = buildQuery(search.$not, 'OR');
          if (subquery) negation = `NOT(${subquery})`;
          break;
        default:
          parts.push(`${p}:${search[p].toString()}`);
      }
    }
  }

  if (parts.length === 0) {
    return negation || '';
  }

  if (parts.length > 1 || negation) {
    let query = negation ? `${negation} ${operator} (` : '(';
    query += parts.join(`) ${operator} (`);
    query += ')';
    return query;
  }

  return parts[0];
}

/**
 * Shorthand function to get multiple docs
 * @param  {Object}   options
 * @param  {Function} callback(err, docs)
 */
exports.find = function (search, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  exports.query(search, options, function (err, result) {
    if (err) return callback(err);

    if (result.response && Array.isArray(result.response.docs)) {
      callback(null, result.response.docs);
    } else {
      callback(new Error('unexpected result, documents not found'));
    }
  });
};

/**
 * Shorthand function to get one doc
 * @param  {Object}   search
 * @param  {Object}   options
 * @param  {Function} callback(err, docs)
 */
exports.findOne = function (search, options, callback) {
  options = options || {};

  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  options.rows = 1;

  exports.query(search, options, function (err, result) {
    if (err) { return callback(err); }

    if (result.response && Array.isArray(result.response.docs) && result.response.docs.length === 1) {
      callback(null, result.response.docs[0]);
    } else {
      callback(new Error('unexpected result, documents not found'));
    }
  });
};

/**
 * Query HAL and get results
 * @param  {Object}   search   the actual query parameters
 * @param  {Object}   options  proxy and query options (sort, rows, fl...)
 * @param  {Function} callback(err, result)
 */
exports.query = function (search, options, callback) {
  options = options || {};

  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  const query = (typeof search === 'string' ? search : buildQuery(search, 'AND') || '*:*');

  const requestOptions = {};
  if (options.hasOwnProperty('proxy')) {
    requestOptions.proxy = options.proxy;
    delete options.proxy;
  }

  // query link
  const host = options.host || "http://api.archives-ouvertes.fr";
  let url =
    options.core === "hal"
      ? `${host}/solr/hal/api/selectall?wt=json&q=${encodeURIComponent(query)}`
      : `${host}/${options.core || "search"}/?wt=json&q=${encodeURIComponent(
          query
        )}`;

  // for convenience, add fields as an alias for fl
  if (options.fields) {
    options.fl = options.fields;
    delete options.fields;
  }
  // for convenience, convert fl to string if it's an array
  if (Array.isArray(options.fl)) {
    options.fl = options.fl.join(',');
  }

  // append options to the query (ex: start=1, rows=10)
  for (const p in options) {
    if (p !== "core")
      url += `&${p}=${options[p]}`;
  }
  axios.get(url, requestOptions).then(response => {
    if (response.status !== 200) {
      return callback(new Error(`unexpected status code : ${response.statusCode}`));
    }

    callback(null, response.data);
  }).catch(error => callback(error));
};

/**
 * Cursor strength to scroll through thousands of results encapsulated in a stream
 */
class ApiHalStream extends Readable {
  constructor (
    options = {
      q: '*'
    }
  ) {
    super({ objectMode: true });
    this.reading = false;
    this.counter = 0;
    this.urlBase = 'http://api.archives-ouvertes.fr/search';
    this.params = options;
    this.params.sort = 'docid asc';
    this.params.cursorMark = '*';
    this.params.rows = 1000;
  }

  _read () {
    if (this.reading) return false;
    this.reading = true;
    const self = this;
    function getMoreUntilDone (url) {
      axios.get(url).then(response => {
        response.data.response.docs.map((doc) => {
          self.counter++;
          self.push(doc);
        });
        if (self.counter < response.data.response.numFound) {
          self.params.cursorMark = response.data.nextCursorMark;
          const nextUrl = `${self.urlBase}/?${querystring.stringify(self.params)}`;
          getMoreUntilDone(nextUrl);
        } else {
          self.push(null);
          self.counter = 0;
          self.reading = false;
        }
      }).catch(error => {
        self.emit('error', error);
      });
    }
    getMoreUntilDone(`${this.urlBase}/?${querystring.stringify(this.params)}`);
  }
}

exports.Stream = ApiHalStream;
