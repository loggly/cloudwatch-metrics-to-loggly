// JavaScript source code
var AWS = require('aws-sdk')
  , Q = require('q')
  , request = require('request');

var counter = 0;
var metricDataQueriesDict = {};

//loggly url, token and tag configuration
//user need to edit while uploading code via blueprint
var logglyConfiguration = {
  url: 'http://logs-01.loggly.com/bulk',
  tags: 'CloudwatchMetrics'
};

var encryptedLogglyToken = "your KMS encrypted key";
var encryptedLogglyTokenBuffer = Buffer.from(encryptedLogglyToken, "base64");

var kms = new AWS.KMS({
  apiVersion: '2014-11-01'
});

var cloudwatch = new AWS.CloudWatch({
  apiVersion: '2010-08-01'
});

//entry point
exports.handler = function (event, context) {
  var parsedStatistics = [];

  var nowDate = new Date();
  var date = nowDate.getTime();

  //time up to which we want to fetch Metrics Statistics
  //we keep it one hour
  var logEndTime = nowDate.toISOString();

  //time from which we want to fetch Metrics Statistics
  var logStartTime = new Date(date - (05 * 60 * 1000)).toISOString();

  //initiate the script here
  decryptLogglyToken().then(function () {
    getMetricsListFromAWSCloudwatch().then(function () {
      sendRemainingStatistics().then(function () {
        context.done('all statistics are sent to Loggly');
      }, function () {
        context.done();
      });
    }, function () {
        context.done();
    });
  }, function () {
    context.done();
  });
  
  //decrypts your Loggly Token from your KMS key
  function decryptLogglyToken() {

    return Q.Promise(function (resolve, reject) {
      var params = {
        CiphertextBlob: encryptedLogglyTokenBuffer
      };
     
      kms.decrypt(params, function (err, data) {
        if (err) {
          console.log(err, err.stack); // an error occurred
          reject();
        }
        else {
          // successful response
          logglyConfiguration.customerToken = data.Plaintext.toString('ascii');
          resolve();
        }
      });
    });
  }

  //retreives all list of valid metrics from cloudwatch
  function getMetricsListFromAWSCloudwatch() {

    return Q.Promise(function (resolve, reject) {
      var promisesResult = [];
      var getMetricsList = function (nextToken) {
        // Remove Coments if requierd filter
        var params = {
          
          /*
          // Add filter dimensions
          // Remove Coments if requierd filter
          Dimensions: [{
              // Required
              Name:"String_Value" ,
              Value:"" 
            },
          ],
          //Add Metric name : ["CPUUtilization","DiskReadOps","StatusCheckFailed_System"] -> String Values
          MetricName:"String Value"           
          // more filters
            
         */
        };


        //The token returned by a previous call to indicate that there is more data available
        //if nextToken returned then next token should
        //present to get the Metrics from next page
        if (nextToken != null) {
          params.NextToken = nextToken;
        }

        cloudwatch.listMetrics(params, function (err, result) {
          if (err) {
            console.log(err, err.stack); // an error occurred
          }
          else {
            var pMetricName, pNamespace, pName, pValue;

            var queries = [];
            for (var i = 0; i < result.Metrics.length; i++) {
              pNamespace = result.Metrics[i].Namespace;
              pMetricName = result.Metrics[i].MetricName;
              for (var j = 0; j < result.Metrics[i].Dimensions.length; j++) {
                pName = result.Metrics[i].Dimensions[j].Name
                pValue = result.Metrics[i].Dimensions[j].Value

                if (!pName || !pValue) continue;

                queries.push({metricName: pMetricName, namespace: pNamespace, name: pName, value: pValue});
                if (queries.length == 20) {
                  var promise = fetchMetricDataFromMetrics(queries);
                  promisesResult.push(promise);
                  queries = [];
                }
              }
            }

            if (queries.length > 0) {
              var promise = fetchMetricDataFromMetrics(queries);
              promisesResult.push(promise);
              queries = [];
            }
          }

          if (result.NextToken) {
            getMetricsList(result.NextToken);
          }
          else {
            Q.allSettled(promisesResult)
           .then(function () {
             resolve();
           }, function () {
             reject();
           });
          }
        });
      }
      getMetricsList();
    });
  }

  function getMetricDataQuery(query, stat, id) {
    return {
      Id: id,
      MetricStat: {
        Metric: {
          Namespace: query.namespace,
          MetricName: query.metricName,
          Dimensions: [{
            Name: query.name,
            Value: query.value
          }]
        },
        Period: 60,
        Stat: stat
      }
    };
  }

  function fetchMetricDataFromMetrics(queries) {
    return Q.Promise(function (resolve, reject) {

      /*The maximum number of data points returned from a single GetMetricStatistics request is 1,440, 
      wereas the maximum number of data points that can be queried is 50,850. If you make a request 
      that generates more than 1,440 data points, Amazon CloudWatch returns an error. In such a case, 
      you can alter the request by narrowing the specified time range or increasing the specified period. 
      Alternatively, you can make multiple requests across adjacent time ranges.*/

      var metricDataQueries = [];
      for (var q in queries) {
        var id = 'm' + counter;
        metricDataQueriesDict[id] = queries[q];

        metricDataQueries.push(getMetricDataQuery(queries[q], 'Average', id + '_average'));
        metricDataQueries.push(getMetricDataQuery(queries[q], 'Minimum', id + '_minimum'));
        metricDataQueries.push(getMetricDataQuery(queries[q], 'Maximum', id + '_maximum'));
        metricDataQueries.push(getMetricDataQuery(queries[q], 'SampleCount', id + '_samplecount'));
        metricDataQueries.push(getMetricDataQuery(queries[q], 'Sum', id + '_sum'));
        counter++;
      }

      var params = {
        EndTime: logEndTime, //required
        StartTime: logStartTime, //required
        MetricDataQueries: metricDataQueries
      };

      function fetch(params, nextToken) {
        if (nextToken != null) {
          params.NextToken = nextToken;
        }

        var promises = [];
        try {
          cloudwatch.getMetricData(params, function (err, data) {
            if (err) {
              console.log(err, err.stack); // an error occurred
            }
            else {
              var resultsByStat = {}
              for (var a in data.MetricDataResults) {
                var metricId = data.MetricDataResults[a].Id;
                var parts = metricId.split('_');
                resultsByStat[parts[0]] = resultsByStat[parts[0]] || {};
                resultsByStat[parts[0]][parts[1]] = data.MetricDataResults[a];
              }

              for (var id in resultsByStat) {
                for (var i in resultsByStat[id]['average'].Timestamps) {
                  var timestamp = resultsByStat[id]['average'].Timestamps[i];
                  var average = resultsByStat[id]['average'].Values[i];
                  var minimum = resultsByStat[id]['minimum'].Values[i];
                  var maximum = resultsByStat[id]['maximum'].Values[i];
                  var samplecount = resultsByStat[id]['samplecount'].Values[i];
                  var sum = resultsByStat[id]['sum'].Values[i];

                  var promise = parseStatistics(timestamp, average, minimum, maximum, samplecount, sum, 
                    metricDataQueriesDict[id].metricName,
                    metricDataQueriesDict[id].name,
                    metricDataQueriesDict[id].value,
                    metricDataQueriesDict[id].namespace)
                  promises.push(promise);
                }
              }
              Q.allSettled(promises).then(function () {
                resolve();
              }, function () {
                reject();
              });
            }

            if (data.NextToken) {
              fetch(params, data.NextToken);
            }
          });
        }
        catch (e) {
          console.log(e);
        }
      }
      fetch(params);
    });
  }

  //converts the Statistics to a valid JSON object with the sufficient infomation required

  function parseStatistics(timestamp, average, minimum, maximum, samplecount, sum, metricName, dimensionName, 
    dimensionValue, namespace) {
    return Q.promise(function (resolve, reject) {

      var staticdata = {
        "timestamp": timestamp.toISOString(),
        "sampleCount": samplecount,
        "average": average,
        "sum": sum,
        "minimum": minimum,
        "maximum": maximum,
        "metricName": metricName,
        "namespace": namespace
      };
      staticdata[firstToLowerCase(dimensionName)] = dimensionValue;

      postStatisticsToLoggly(staticdata).then(function () {
        resolve();
      }, function () {
        reject();
      });

    });
  }

  //uploads the statistics to Loggly
  //we will hold the statistics in an array until they reaches to 200
  //then set the count of zero.
  function postStatisticsToLoggly(event) {

    return Q.promise(function (resolve, reject) {
      if (parsedStatistics.length == 200) {
        upload().then(function () {
          resolve();
        }, function () {
          reject();
        });
      } else {
        parsedStatistics.push(event);
        resolve();
      }
    });
  }

  //checks if any more statistics are left
  //after sending Statistics in multiples of 100
  function sendRemainingStatistics() {
    return Q.promise(function (resolve, reject) {
      if (parsedStatistics.length > 0) {
        upload().then(function () {
          resolve();
        }, function () {
          reject();
        });
      } else {
        resolve();
      }
    });
  }

  function upload() {
    return Q.promise(function (resolve, reject) {

      //get all the Statistics, stringify them and join them
      //with the new line character which can be sent to Loggly
      //via bulk endpoint
      var finalResult = parsedStatistics.map(JSON.stringify).join('\n');

      //empty the main statistics array immediately to hold new statistics
      parsedStatistics.length = 0;

      //creating logglyURL at runtime, so that user can change the tag or customer token in the go
      //by modifying the current script
      var logglyURL = logglyConfiguration.url + '/' + logglyConfiguration.customerToken + '/tag/' + logglyConfiguration.tags;

      //create request options to send Statistics
      try {
        var requestOptions = {
          uri: logglyURL,
          method: 'POST',
          headers: {}
        };

        requestOptions.body = finalResult;

        //now send the Statistics to Loggly
        request(requestOptions, function (err, response, body) {
          if (err) {
            console.log('Error while uploading Statistics to Loggly');
            reject();
          } else {
            resolve();
          }
        });
        
      } catch (ex) {
        console.log(ex.message);
        reject();
      }
    });
  }

  //function to convert the first letter of the string to lowercase
  function firstToLowerCase(str) {
    return str.substr(0, 1).toLowerCase() + str.substr(1);
  }
}