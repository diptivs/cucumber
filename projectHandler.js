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
		callback(null, success(params.Item));
	} catch (e) {
		console.log(e);
		callback(null, failure({ status: false }));
	}
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
	console.log("request: " + JSON.stringify(event));
	//console.log(queryStringParameters);
	//var userId;
	//console.log("Received userId: " + event.queryStringParameters.userId);
	//if (event.queryStringParameters !== null && event.queryStringParameters !== undefined) {
     //   if (event.queryStringParameters.userId !== undefined && event.queryStringParameters.userId !== null ) {
     //       console.log("Received userId: " + event.queryStringParameters.userId);
     //       userId = event.queryStringParameters.userId;
     //   }
	//}
	const params = {
		TableName: process.env.projectstableName,
		FilterExpression: '#projectOwner = :userId',
		ExpressionAttributeNames: {
		'#projectOwner': 'projectOwner',
		},
		ExpressionAttributeValues: {
        ':userId': event.managerUserId,		
		},
	};
		
	try {		
		dynamoDb.scan(params, function(err,data){
			if(err){
				//console.log(userId);
				console.log(err+"******"+JSON.stringify(event));
				callback(err,null);
			}else{
				console.log(data+"----------"+JSON.stringify(event));
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
	const data = JSON.parse(event.body);
console.log(data.userId);	
	const params = {
		TableName: process.env.projectstableName,
		FilterExpression: 'contains (#projectContributors, :userId)',
		ExpressionAttributeNames: {
		'#projectContributors': 'projectContributors',
		},
		ExpressionAttributeValues: {
        ':userId': data.userId	
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