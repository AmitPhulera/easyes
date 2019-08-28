## EasyES ##

Provides an interface to query from ElasticSearch using the latest ElasticSearch SDK. 


It is built for a special usecase, to translate sails like queries to elastic search and get custom results. 
The parameters used in the library serves a special usecase that I my team are currently working on. 
In future, I have plans to generalise this library and which will be suitable for basic elastic search querying and indexing. The plan is that developer should only focus on "what" he needs rather then "how" to get it. The library should be intelligent to use the best possible way to retrieve data from elastic search.

The data structures for which this is built are present in tests/mockData directory.


## Use ##
- Installation
```
npm i @amitphulera/easyes
```
- Intialization 

```
const {EasyES} = require('@amitphulera/easyes');
// Iniitialise with you AWS elasticsearch domain and region
const es = new EasyES(
    'https://some-elasticsearchcluster-somerandomid.us-west-2.es.amazonaws.com',
    'us-west-2',
);
```
### Methods 

- query(searchObj, options) : Queries elastic search on the basis of search object provided. Will return upto 10k matching results by default, if size is not specified. If you want to get all the results then set size to -1 and please mind that only 10 thousand elements can be returned after setting to -1. 
    - searchObj sails-dynamo like query object
    - filters other options to pass to elastic search for the query
    The following filters are avaialable as of present
        - filters.size defaults to 10000
        - filters.sort defaults to asc
        - filters.format defaults to 'datadevice'.
    raw|flatten|dataDevice|tsDevParamMap
    dataDevice : The results are structured like datadevice output
    which basically is all the parameters will be wrapped in data key by default, if
    you need flattened response set it to true.
    raw : If you want raw elastic search response then set this
    variable to true. This will dominate over flatten, and flatten will be ignored if
     this parameter is set to true
    flatten : Will return you flattened results
    tsDevParamMap : A map containing timestamp as primary key then indexed by deviceId
    then by parameter
    ```
    {
    <timestamp>:
       <deviceId>:{
         <paramA>:<val>,
         <paramB>:<val>
        }
    }
    ```
- **lastKnownParamValue(siteId, timestamp, deviceId, field)** : Queries elastic serach to get the last known value of parameter specified in field before the timestamp.
Let say we want to get the last kvah value before 10th august 2019 of a particular deviceId then this function can be used.

- **indexRecords(records)** : Takes an array of records and indexes them in elasticsearch using bulk API call. The function returns a promise of the bulk API call of ElasticSearch which tries to index all the records.
