import uuid from "uuid";
import * as dynamoDbLib from "./libs/dynamodb-lib";
import { success, failure } from "./libs/response-lib";
import AWS from "aws-sdk";

//creates preference
export async function create(event, context, callback) {
	const docClient = new AWS.DynamoDB.DocumentClient();	
	const data = JSON.parse(event.body);
	const params = {
		TableName: process.env.preferncestableName,
		Item: {
			preferenceId: uuid.v1(),
			userId: event.requestContext.identity.cognitoIdentityId,
			prefPomodoroCount: data.prefPomodoroCount,
			prefShortBreakSize: data.prefShortBreakSize,
			prefLongBreakSize: data.prefLongBreakSize,
			prefWorkSchedule: data.prefWorkDay												
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

//Fetches pref details based on the prefId specified
export async function retrieve(event, context, callback) {
	const params = {
		TableName: process.env.preferncestableName,
		Key: {
			preferenceId: event.pathParameters.id
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

//Retrieves the user preference based on the user specified
export async function retrieveUserPreference(event, context, callback) {
	const dynamoDb = new AWS.DynamoDB.DocumentClient();
	const params = {
		TableName: process.env.preferncestableName,
		FilterExpression: '#userId = :userId',
		ExpressionAttributeNames: {
		'#userId': 'userId',
		},
		ExpressionAttributeValues: {
        ':userId': event.requestContext.identity.cognitoIdentityId,
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

//Deletes preference based on the id specified
export async function deletePreference(event, context, callback) {
	
	const params = {
		TableName: process.env.preferncestableName,
		Key: {
			preferenceId: event.pathParameters.id
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

//Updates the preferences of the user
export async function update(event, context, callback) {
	const data = JSON.parse(event.body);	
	const docClient = new AWS.DynamoDB.DocumentClient();
	const params = {
		TableName: process.env.preferncestableName,
		Key: {
			preferenceId: event.pathParameters.id
		},
		UpdateExpression: "SET prefPomodoroCount = :prefPomodoroCount, prefShortBreakSize = :prefShortBreakSize, prefLongBreakSize = :prefLongBreakSize, prefWorkSchedule = :prefWorkSchedule",
		ExpressionAttributeValues: {
				":prefPomodoroCount": data.prefPomodoroCount,
				":prefShortBreakSize": data.prefShortBreakSize,
				":prefLongBreakSize": data.prefLongBreakSize,
				":prefWorkSchedule": data.prefWorkSchedule			
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