# MetHAL

Wrapper around the HAL API. It allows to query the HAL database in a convenient way.

## Install
```bash
  npm install --save @ezpaarse-project/methal
```

## Usage
```javascript
  var methal = require('methal');

  methal.query({ docid: '19' }, { fields: '*' }, function (err, result) {
    console.log(result);
  });
```

## Methods
### query(search, [options,] callback)
Perform a query and get the JSON response from the API. The callback is called with a potential error and the result object. (see below)

#### Result example
```javascript
{
  "response":{
    // number of documents that match the query
    "numFound": 1,
    // index of the first document
    "start": 0,
    // actual documents (NB: the amount is limited by default)
    "docs":[{
      "docid": 19,
      "uri_s": "https://hal.archives-ouvertes.fr/hal-00000019",
      "label_s": "Mark Wexler, Francesco Panerai, Ivan Lamouret, Jacques Droulez. Self-motion and the perception of stationary objects. Nature, Nature Publishing Group, 2001, 409, pp.85-88. &lt;hal-00000019&gt;"
    }]
  }
}
```

### find(search, [options,] callback)
Shorthand function to get multiple documents. Returns only the docs instead of the full JSON.

### findOne(search, [options,] callback)
Shorthand function to get a single document. Limit the query to one row and returns only the doc instead of the full JSON.

## Querying
The `search` can be eiter an object or a raw query string that use Solr syntax. The object supports `$and`, `$or` and `$not` operators between fields.

Have a look at the [API documentation](http://api.archives-ouvertes.fr/docs/search/schema/fields/#fields) to get a list of all available fields.

### Query examples
```javascript
// city contains "Paris"
{ city_t: 'paris' }
```
```javascript
// city equals "Paris"
{ city_s: 'Paris' }
```
```javascript
// city contains either "Paris" or "London"
{ city_t: 'paris OR london' }
```
```javascript
// title contains "milk" and (city equals "London" or language equals "en")
{
  title_t: 'milk',
  $or: [
    { city_s: 'London' },
    { language_s: 'en' }
  ]
}
```
```javascript
// city equals "Paris" and (language is not "fr" and fulltext does not contain "milk")
{
  { city_s: 'Paris' },
  $not: [
    { language_s: 'fr' },
    { fulltext_t: 'milk' }
  ]
}
```

## Main options

Have a look at the [API documentation](http://api.archives-ouvertes.fr/docs/search/#sort) to get a full list of available options.

<table>
  <tr>
    <th>Option</th>
    <th>Description</th>
  </tr>
  <tr>
    <td>sort</td>
    <td>Sort results. Ex: "city_s asc", "language_s desc"</td>
  </tr>
  <tr>
    <td>start</td>
    <td>Offset of the first document to return.</td>
  </tr>
  <tr>
    <td>rows</td>
    <td>Number of documents to return (limited by default).</td>
  </tr>
  <tr>
    <td>fl / fields</td>
    <td>Fields to return. Ex: "*", "docid, country_s", ["docid", "country_s"]</td>
  </tr>
  <tr>
    <td>host</td>
    <td>Host of the API (optional default to public API: http://api.archives-ouvertes.fr)</td>
  </tr>
  <tr>
    <td>core</td>
    <td>API core: `search`, `ref/instance`, `hal` (hal team internal use). Default to `search`.</td>
  </tr>
</table>
