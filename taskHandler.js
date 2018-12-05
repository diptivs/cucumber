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
				userId: data.userId,
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
	const docClient = new AWS.DynamoDB.DocumentClient();
	const params = {
		TableName: process.env.taskstableName,
		Key: {
			taskId: event.pathParameters.id
		},
		ReturnValues: 'ALL_OLD'
	};
	try {
		const result = await dynamoDbLib.call("delete", params);
		console.log(result.Attributes);
		//Logic to delete task from userTable
		if(result.Attributes) {			
		const userParams = {
		TableName: process.env.userstableName,
		Key: {
			userId: result.Attributes.userId
		},
		UpdateExpression: 'DELETE taskId :taskId',
		ExpressionAttributeValues: {
			':taskId': docClient.createSet([result.Attributes.taskId])
			},
			ReturnValues: 'UPDATED_NEW'		
		};
		try {
			const updatedResult = await dynamoDbLib.call("update", userParams);
			console.log("entered try" + updatedResult);
			callback(null, success({ status: true }));
		} catch (e) {
			console.log(e);
			console.log("entered catch" + e);
			callback(null, failure({ status: false, error: "Task update on user failed." }));
		}
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
	var attrValues = {},
        filterExpression = null,
        updateExpression = function(expr, newStr){
            if (expr) {
                expr = expr+" AND "+newStr;
            } else {
                expr = newStr;
            }
            return expr
        };

	if(event.queryStringParameters.userId) {
        attrValues[':userId'] = event.queryStringParameters.userId;
        filterExpression = updateExpression(filterExpression, "userId = :userId");
    }

    if(event.queryStringParameters.projectId) {
        attrValues[':projectId'] = event.queryStringParameters.projectId;
        filterExpression = updateExpression(filterExpression, "projectId = :projectId");
    }

	if(event.queryStringParameters.taskStatus){
        attrValues[':taskStatus'] = event.queryStringParameters.taskStatus;
        filterExpression = updateExpression(filterExpression, "taskStatus = :taskStatus");
	}

	const dynamoDb = new AWS.DynamoDB.DocumentClient(),
          params = {
                TableName: process.env.taskstableName,
                FilterExpression: filterExpression,
                ExpressionAttributeValues: attrValues
            };

    console.log("ListTasks", params);
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

export async function updateTaskPriority(event, context, callback) {
	const data = JSON.parse(event.body);
	var params;
	console.log(data.tasks+data.tasks.length);
	for(var i=0;i<data.tasks.length;i++) {
	params = {
		TableName: process.env.taskstableName,
		Key: {
			taskId: data.tasks[i].taskId
		},
		UpdateExpression: "SET taskPriority = :taskPriority",		
		ExpressionAttributeValues: {
				":taskPriority": data.tasks[i].taskPriority				
		},
		ReturnValues: 'UPDATED_NEW'
	};		
	try {
		console.log(params);
		const result = await dynamoDbLib.call("update", params);
		console.log(result);
		
	} catch (e) {
		console.log(e)
		callback(null, failure({ status: false }));
	}
}
callback(null, success({status: true}));
}


	

//Updates task info
export async function update(event, context, callback) {
	const data = JSON.parse(event.body);
	var params;
	if(data.taskPomodoroEndTime && data.taskStatus) {	
		params = {
		TableName: process.env.taskstableName,
		Key: {
			taskId: event.pathParameters.id
		},
		UpdateExpression: "SET taskPomodoroEndTime = :taskPomodoroEndTime,taskStatus = :taskStatus",		
		ExpressionAttributeValues: {
				":taskPomodoroEndTime": data.taskPomodoroEndTime,
				":taskStatus" : data.taskStatus
		}
	};	
	} else if(data.taskPomodoroStartTime && data.taskStatus) {
		params = {
		TableName: process.env.taskstableName,
		Key: {
			taskId: event.pathParameters.id
		},
		UpdateExpression: "SET taskPomodoroStartTime = :taskPomodoroStartTime,taskStatus = :taskStatus",
		ExpressionAttributeValues: {
				":taskPomodoroStartTime": data.taskPomodoroStartTime,
				":taskStatus" : data.taskStatus
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
			ReturnValues: 'UPDATED_OLD'
	};
	}

	try {
		const result = await dynamoDbLib.call("update", params);
		console.log(result);
		//Update userTable with taskId for respective Users
		if(data.userId){
		const docClient = new AWS.DynamoDB.DocumentClient();	
		const deleteTaskparams = {
		TableName: process.env.userstableName,
		Key: {
			userId: result.Attributes.userId
		},
		UpdateExpression: "DELETE taskId :taskId",
		ExpressionAttributeValues: {
				":taskId": docClient.createSet(event.pathParameters.id)				
			},
		};
		const createTaskparams = {
		TableName: process.env.userstableName,
		Key: {
			userId: data.userId
		},
		UpdateExpression: "ADD taskId :taskId",
		ExpressionAttributeValues: {
				":taskId": docClient.createSet(event.pathParameters.id)				
			},
		};
		try {
		const deleteResult = await dynamoDbLib.call("update", deleteTaskparams);
		const createResult = await dynamoDbLib.call("update", createTaskparams);
		callback(null, success({ status: true }));
		} catch (e) {
		console.log(e)
		callback(null, failure({ status: false ,error:"Failed to update user table"}));
		}
		}			
		callback(null, success({ status: true }));
	} catch (e) {
		console.log(e)
		callback(null, failure({ status: false }));
	}
}




