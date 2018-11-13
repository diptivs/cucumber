import uuid from "uuid";
import * as dynamoDbLib from "./libs/dynamodb-lib";
import { success, failure } from "./libs/response-lib";

export async function create(event, context, callback) {
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
			taskPomodoraStartTime: data.taskPomodoraStartTime,
			taskPomodoraEndTime: data.taskPomodoraEndTime,
						
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


