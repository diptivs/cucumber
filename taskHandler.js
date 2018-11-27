import uuid from "uuid";
import * as dynamoDbLib from "./libs/dynamodb-lib";
import { success, failure } from "./libs/response-lib";
import AWS from "aws-sdk";

//creates new task
export async function create(event, context, callback) {
	const docClient = new AWS.DynamoDB.DocumentClient();	
	const data = JSON.parse(event.body);
	const params = {
		TableName: process.env.taskstableName,
		Item: {
			taskId: uuid.v1(),
			projectId: data.projectId,
			userId: data.userId,
			taskName: data.taskName,
			taskDescription: data.taskDescription,
			taskStatus: data.taskStatus,
			taskPomodoroCount: data.taskPomodoroCount,
			taskPomodoroStartTime: data.taskPomodoroStartTime,
			taskPomodoroEndTime: data.taskPomodoroEndTime,
			taskPriority: data.taskPriority					
		}
	};
	try {
		await dynamoDbLib.call("put", params);
		const userparams = {
			TableName: process.env.userstableName,
			Key: {
				userId: event.requestContext.identity.cognitoIdentityId,
			},
			UpdateExpression: 'ADD taskId :taskId',
			ExpressionAttributeValues: {
			':taskId': docClient.createSet([params.Item.taskId])
			},
		ReturnValues: 'UPDATED_NEW'		
		}
		try {
			const result = await dynamoDbLib.call("update", userparams);
			console.log("entered try" + result);
			callback(null, success({ status: true }));
		} catch (e) {
			console.log(e);
			console.log("entered catch" + e);
			callback(null, failure({ status: false, error: "Task update on user failed." }));
		}
		callback(null, failure({ status: true }));		
	} catch (e) {
	callback(null, failure({ status: false })); }
	
}
//deletes the task specified
export async function deleteTask(event, context, callback) {
	const params = {
		TableName: process.env.taskstableName,
		Key: {
			taskId: event.pathParameters.id
		},
		ReturnValues: 'ALL_OLD'
	};

	try {
		const result = await dynamoDbLib.call("delete", params);
		if(result.Attributes) {		
		callback(null, success({ status: true }));
		} else {
			callback(null, failure({ status: false , error: "Unable to delete" }));
		}
	} catch (e) {
		console.log(e);
		callback(null, failure({ status: false }));
	}
}

//Retrieve the task nased on id
export async function retrieve(event, context, callback) {
	const params = {
		TableName: process.env.taskstableName,
		Key: {
			taskId: event.pathParameters.id
		}
	};
	try {
		const result = await dynamoDbLib.call("get", params);
		if (result.Item) {
		// Return the retrieved item
		callback(null, success(result.Item));
		} else {
		callback(null, failure({ status: false, error: "Item not found."}));
		}
	} catch (e) {
	callback(null, failure({ status: false })); }
}

//List Tasks-allowed query parameters are userId,projectId,taskStatus
export async function listTasks(event, context, callback) {
	const dynamoDb = new AWS.DynamoDB.DocumentClient();	
	var params;
	if(event.queryStringParameters.userId) {
	 params = {
		TableName: process.env.taskstableName,
		FilterExpression: '#userId = :userId',
		ExpressionAttributeNames: {
		'#userId': 'userId',
		},
		ExpressionAttributeValues: {
        ':userId': event.queryStringParameters.userId,
		},
	};
	} else if(event.queryStringParameters.projectId) {
		if(event.queryStringParameters.taskStatus){
		params = {
		TableName: process.env.taskstableName,
		FilterExpression: '#projectId = :projectId AND #taskStatus = :taskStatus',
		ExpressionAttributeNames: {
		'#projectId': 'projectId',
		'#taskStatus': 'taskStatus',
		},
		ExpressionAttributeValues: {
        ':projectId': event.queryStringParameters.projectId,
		':taskStatus': event.queryStringParameters.taskStatus	
		},
	};
		} else{
		params = {
		TableName: process.env.taskstableName,
		FilterExpression: '#projectId = :projectId',
		ExpressionAttributeNames: {
		'#projectId': 'projectId',
		},
		ExpressionAttributeValues: {
        ':projectId': event.queryStringParameters.projectId,
		},
	};
	}
	}
	try {	
		const scanResult = await dynamoDb.scan(params).promise();				
		if(scanResult){
			console.log(scanResult.Items);
			//sorts based on priority-scan does not support sorting
			scanResult.Items.sort(function(a, b){return a.taskPriority - b.taskPriority})
			callback(null, success(scanResult));				
			}else{
				callback(err,failure({ status: false , error: "Task does not exist." }));
			}		
	} catch (e) {
		console.log(e);
		callback(null, failure({ status: false }));
}
}

//Updates task info
export async function update(event, context, callback) {
	const data = JSON.parse(event.body);
	var params;
	if(data.taskPomodoroEndTime) {	
		params = {
		TableName: process.env.taskstableName,
		Key: {
			taskId: event.pathParameters.id
		},
		UpdateExpression: "SET taskPomodoroEndTime = :taskPomodoroEndTime",		
		ExpressionAttributeValues: {
				":taskPomodoroEndTime": data.taskPomodoroEndTime				
		}
	};	
	} else if(data.taskPomodoroStartTime) {
		params = {
		TableName: process.env.taskstableName,
		Key: {
			taskId: event.pathParameters.id
		},
		UpdateExpression: "SET taskPomodoroStartTime = :taskPomodoroStartTime",
		ExpressionAttributeValues: {
				":taskPomodoroStartTime": data.taskPomodoroStartTime
				
			},
	};		
	} else if(data.userId && data.taskName && data.taskDescription && data.taskStatus && data.taskPomodoroCount && data.taskPriority) {
		params = {
		TableName: process.env.taskstableName,
		Key: {
			taskId: event.pathParameters.id
		},
		UpdateExpression: "SET userId = :userId, taskName = :taskName, taskDescription = :taskDescription, taskStatus = :taskStatus, taskPomodoroCount = :taskPomodoroCount, taskPriority = :taskPriority",
		ExpressionAttributeValues: {
				":userId": data.userId,
				":taskName": data.taskName,
				":taskDescription": data.taskDescription,
				":taskStatus": data.taskStatus,
				":taskPomodoroCount": data.taskPomodoroCount,
				":taskPriority": data.taskPriority			
			},
	};
	}

	try {
		const result = await dynamoDbLib.call("update", params);
		callback(null, success({ status: true }));
	} catch (e) {
		console.log(e)
		callback(null, failure({ status: false }));
	}
}


