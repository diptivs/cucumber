import uuid from "uuid";
import * as dynamoDbLib from "./libs/dynamodb-lib";
import { success, failure } from "./libs/response-lib";
import AWS from "aws-sdk";

//creates project
export async function create(event, context, callback) {
	const docClient = new AWS.DynamoDB.DocumentClient();	
	const data = JSON.parse(event.body);
	const params = {
		TableName: process.env.projectstableName,
		Item: {
			projectId: uuid.v1(),
			projectName: data.projectName,
			projectDescription: data.projectDescription,
			projectStatus: data.projectStatus,
			projectOwner: data.projectOwner,
			projectContributors: docClient.createSet(data.projectContributors),
			projectStartDate: data.projectStartDate,
			projectEndDate: data.projectEndDate									
		}
	};
	try {
		await dynamoDbLib.call("put", params);
		const userparams = {
			TableName: process.env.userstableName,
			Key: {
				userId: event.requestContext.identity.cognitoIdentityId,
			},
			UpdateExpression: 'ADD projectId :projectId',
			ExpressionAttributeValues: {
			':projectId': docClient.createSet([params.Item.projectId])
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
			callback(null, failure({ status: false, error: "Project update on user failed." }));
		}
		callback(null, failure({ status: true }));		
	} catch (e) {
	callback(null, failure({ status: false })); }
	
}

//Fetches project details based on the projectId specified
export async function retrieve(event, context, callback) {
	const params = {
		TableName: process.env.projectstableName,
		Key: {
			projectId: event.pathParameters.id
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

//Lists all projects of the manager
export async function listManagerProjects(event, context, callback) {
	const dynamoDb = new AWS.DynamoDB.DocumentClient();	
	const inputParams = JSON.parse(event.queryStringParameters);
	console.log(inputParams.userId);
	const params = {
		TableName: process.env.projectstableName,
		FilterExpression: '#projectOwner = :userId',
		ExpressionAttributeNames: {
		'#projectOwner': 'projectOwner',
		},
		ExpressionAttributeValues: {
        ':userId': inputParams.userId,		
		},
	};
	try {		
		dynamoDb.scan(params, function(err,data){
			if(err){
				//console.log(userId);
				console.log(err);
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

//Lists all projects of the developer working on
export async function listDeveloperProjects(event, context, callback) {
	const dynamoDb = new AWS.DynamoDB.DocumentClient();
	const inputParams = JSON.parse(event.queryStringParameters);	
	console.log(inputParams.userId);	
	const params = {
		TableName: process.env.projectstableName,
		FilterExpression: 'contains (#projectContributors, :userId)',
		ExpressionAttributeNames: {
		'#projectContributors': 'projectContributors',
		},
		ExpressionAttributeValues: {
        ':userId': inputParams.userId	
		},
	};
		
	try {		
		dynamoDb.scan(params, function(err,data){
			if(err){
				console.log(err);
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


//Deletes project based on the projectid specified
export async function deleteProject(event, context, callback) {
	const params = {
		TableName: process.env.projectstableName,
		Key: {
			projectId: event.pathParameters.id
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

//Updates the project info
export async function update(event, context, callback) {
	const data = JSON.parse(event.body);	
	const docClient = new AWS.DynamoDB.DocumentClient();
	const params = {
		TableName: process.env.projectstableName,
		Key: {
			projectId: event.pathParameters.id
		},
		UpdateExpression: "SET projectName = :projectName, projectDescription = :projectDescription, projectStatus = :projectStatus, projectOwner = :projectOwner, projectContributors = :projectContributors, projectEndDate = :projectEndDate",
		ExpressionAttributeValues: {
				":projectName": data.projectName,
				":projectDescription": data.projectDescription,
				":projectOwner": data.projectOwner,
				":projectStatus": data.projectStatus,
				":projectContributors": docClient.createSet(data.projectContributors),
				":projectEndDate": data.projectEndDate
				
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