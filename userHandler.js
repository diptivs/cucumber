import uuid from "uuid";
import * as dynamoDbLib from "./libs/dynamodb-lib";
import { success, failure } from "./libs/response-lib";
import AWS from "aws-sdk";

//Add new user
export async function create(event, context, callback) {
	const docClient = new AWS.DynamoDB.DocumentClient();
	const data = JSON.parse(event.body);
	const params = {
		TableName: process.env.userstableName,
		Item: {
			userId: event.requestContext.identity.cognitoIdentityId,
			firstName: data.firstName,
			lastName: data.lastName,
			emailId: data.emailId,
			//projectId: data.projectId ? docClient.createSet(data.projectId) : "",
			//taskId: data.taskId ? docClient.createSet(data.taskId) : "",	
			userRole: data.role,
			//preferncesId: data.preferenceId	? data.preferenceId	: ""			
		}
	};
	try {
		await dynamoDbLib.call("put", params);
		callback(null, success(params.Item));
	} catch (e) {
		console.log(e);
		callback(null, failure({ status: false }));
	}
}

//Fetches user details based on the userid specified
export async function retrieve(event, context, callback) {
	const params = {
		TableName: process.env.userstableName,
		Key: {
			userId: event.pathParameters.id
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

//Deletes user based on the userid specified
export async function deleteUser(event, context, callback) {
	const params = {
		TableName: process.env.userstableName,
		Key: {
			userId: event.pathParameters.id
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

//Updates user details
export async function update(event, context, callback) {
	const data = JSON.parse(event.body);	
	const docClient = new AWS.DynamoDB.DocumentClient();
	const params = {
		TableName: process.env.userstableName,
		Key: {
			userId: event.pathParameters.id
		},
		UpdateExpression: "SET firstName = :firstName, lastName = :lastName, projectId = :projectId, taskId = :taskId, userRole = :userRole",
		ExpressionAttributeValues: {
				":firstName": data.firstName,
				":lastName": data.lastName,
				":userRole": data.role,
				":projectId": docClient.createSet(data.projectId),
				":taskId": docClient.createSet(data.taskId)
				
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

//Fetches user details based on the emailId specified - used to fetch project details
export function retrieveOnEmail(event, context, callback) {
	const dynamoDb = new AWS.DynamoDB.DocumentClient();
	let params = {
		TableName: process.env.userstableName,
		FilterExpression: "emailId = :emailId",
		ExpressionAttributeValues: {
			":emailId" : event.queryStringParameters.emailId
		},
		Limit: 100
	};
	try {		
		dynamoDb.scan(params, function(err,data){
			if(err){
				callback(err,null);
			}else{
				callback(null, success(data));
			}
		});
	} catch (e) {
		console.log(e);
		callback(null, failure({ status: false }));
	}
}