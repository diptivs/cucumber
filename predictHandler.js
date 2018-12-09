import AWS from "aws-sdk";
import { success, failure } from "./libs/response-lib";

export async function predict(event, context, callback) {
const data = JSON.parse(event.body);
var machinelearning = new AWS.MachineLearning({region: "us-east-1"});
var params = {
  MLModelId: 'ml-Aa8HA5feOkS', /* required */
  PredictEndpoint: 'https://realtime.machinelearning.us-east-1.amazonaws.com', /* required */
  Record: {
	  "taskId":data.taskId,
	  "taskName":data.taskName
	  }
  };
try {
var returnData = await machinelearning.predict(params).promise();
//console.log(returnData);
  if (returnData.Prediction){
	  callback(null, success(returnData.Prediction));
  }else {
	  callback(null, failure({ status: false }));
  }
}
catch(e){
	callback(null,failure("failed to predict pomodoro count"+e));
}
}