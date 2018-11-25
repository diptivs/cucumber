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
			taskPomodoraCount: data.taskPomodoraCount,
			taskPomodoroStartTime: data.taskPomodoroStartTime,
			taskPomodoroEndTime: data.taskPomodoroEndTime,
						
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
		}
	};

	try {
		const result = await dynamoDbLib.call("delete", params);
		callback(null, success({ status: true }));
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

//List all Tasks of the user
export async function listAllTasks(event, context, callback) {
	const dynamoDb = new AWS.DynamoDB.DocumentClient();		
	const inputParams = JSON.parse(event.queryStringParameters);
	console.log(inputParams.userId);	
	const params = {
		TableName: process.env.taskstableName,
		FilterExpression: '#userId = :userId',
		ExpressionAttributeNames: {
		'#userId': 'userId',
		},
		ExpressionAttributeValues: {
        ':userId': inputParams.userId,
		},
	};
	try {		
		dynamoDb.scan(params, function(err,data){
			if(err){
				callback(err,null);
			}else{
				console.log(data);
				callback(null, success(data));
			}
		});
	} catch (e) {
		console.log(e);
		callback(null, failure({ status: false }));
}
}

//Updates task info
export async function update(event, context, callback) {
	const data = JSON.parse(event.body);	
	const params = {
		TableName: process.env.taskstableName,
		Key: {
			taskId: event.pathParameters.id
		},
		UpdateExpression: "SET userId = :userId, taskName = :taskName, taskDescription = :taskDescription, taskStatus = :taskStatus, taskPomodoroCount = :taskPomodoroCount, taskPomodoroEndTime = :taskPomodoroEndTime",
		ExpressionAttributeValues: {
				":userId": data.userId,
				":taskName": data.taskName,
				":taskDescription": data.taskDescription,
				":taskStatus": data.taskStatus,
				":taskPomodoroCount": data.taskPomodoroCount,
				":taskPomodoroEndTime": data.taskPomodoroEndTime
				
			},
	};

	try {
		const result = await dynamoDbLib.call("update", params);
		callback(null, success({ status: true }));
	} catch (e) {
		console.log(e)
		callback(null, failure({ status: false }));
	}
}


