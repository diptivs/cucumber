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
export async function listProjectsForUser(event, context, callback) {	
	const params = {
		TableName: process.env.userstableName,
		Key: {
			userId: event.queryStringParameters.userId
		}
	};
	try {
		console.log(params);
		const result = await dynamoDbLib.call("get", params);
		console.log(result);
		if (result.Item) {
			// Return the retrieved item
			const dynamoDb = new AWS.DynamoDB.DocumentClient();
			var projectparams;
			if(result.Item.userRole == "manager") {
			projectparams = {
			TableName: process.env.projectstableName,
			FilterExpression: ' projectOwner = :userId',
			ExpressionAttributeValues: {
			':userId': event.queryStringParameters.userId		
			}
		};
		}else if(result.Item.userRole=="developer") {
			projectparams = {
			TableName: process.env.projectstableName,
			FilterExpression: 'contains (projectContributors, :userId)',
			ExpressionAttributeValues: {
			':userId': event.queryStringParameters.userId		
			}
		};
		}
		try {
			console.log(projectparams);
			const scanResult = await dynamoDb.scan(projectparams).promise();
			if(scanResult){
			console.log(scanResult);
			callback(null, success(scanResult));
				//console.log(userId);				
			}else{
			console.log(err);
			callback(err,null);	
			}
		} catch (e) {
		console.log(e);
		callback(null, failure({ status: false }));
	}}
	
	}catch (e) {
	callback(null, failure({ status: false , error: "User does not exist." })); 
	}
}

//Lists all projects of the manager
export async function listAllProjectsDetailsForUser(event, context, callback) {	
	const dynamoDb = new AWS.DynamoDB.DocumentClient();
	var projectparams;
	var contributorprojectparams;
			//removed role check as we are not supporting role based model any more	and checking based on prjectOwner and projectContributors		
		try {
			projectparams = {
				TableName: process.env.projectstableName,
				FilterExpression: ' projectOwner = :userId',
				ExpressionAttributeValues: {
				':userId': event.requestContext.identity.cognitoIdentityId		
				}
				};				
			contributorprojectparams = {
				TableName: process.env.projectstableName,
				FilterExpression: 'contains (projectContributors, :userId)',
				ExpressionAttributeValues: {
				':userId': event.requestContext.identity.cognitoIdentityId		
				}
			};
		
		try {
			console.log(projectparams);
			var projectScanResult = await dynamoDb.scan(projectparams).promise();
			var projectScanResultContributors = await dynamoDb.scan(contributorprojectparams).promise();				
			var projectTaskList = [];
			console.log(projectTaskList);
			console.log(projectScanResult);	
			console.log("If user is contribuor, fetch his projects" +projectScanResultContributors);	
			if(projectScanResult){
				console.log("calling function");
					var role="OWNER_ROLE";
					var result = await fetchtasksForProject(projectScanResult,role,event.requestContext.identity.cognitoIdentityId);	
					console.log(result);
											
					projectTaskList.push(result);
					
			}
			console.log(projectScanResult);				
			if(projectScanResultContributors) {
				console.log("calling function");
					var role="CONTRIBUTOR_ROLE";
					var result = await fetchtasksForProject(projectScanResultContributors,role,event.requestContext.identity.cognitoIdentityId);
					console.log(result);					
					
					projectTaskList.push(result);
			}
			console.log("Final result : "+projectScanResult);			
			callback(null,success(projectTaskList));		
			
		}catch (e) {
		console.log(e);
		callback(null, failure({ status: false, error: "Failed to fetch task details" }));
	}
	
		}catch (e) {
			callback(null, failure({ status: false , error: "User does not exist." })); 
		}
}

 async function fetchtasksForProject(projectList,role,userId) {
	var taskScanResult;
	const dynamoDb = new AWS.DynamoDB.DocumentClient();	
	if(role=="OWNER_ROLE") {
	for(var i=0;i<projectList.Count;i++) {
					console.log(projectList.Items[i].projectId);
					const taskParams={
						TableName: process.env.taskstableName,
						FilterExpression: '#projectId = :projectId',
						ExpressionAttributeNames: {
						'#projectId': 'projectId'
						},
						ExpressionAttributeValues: {
						':projectId' :  projectList.Items[i].projectId
						},
					};
					console.log(taskParams);
					taskScanResult = await dynamoDb.scan(taskParams).promise();
					console.log(taskScanResult);
					projectList.Items[i].tasks=taskScanResult.Items;
					
				}
	} else if(role=="CONTRIBUTOR_ROLE") {
		for(var i=0;i<projectList.Count;i++) {
					console.log(projectList.Items[i].projectId);
					const taskParams={
						TableName: process.env.taskstableName,
						FilterExpression: '#projectId = :projectId AND #userId = :userId',
						ExpressionAttributeNames: {
						'#projectId': 'projectId',
						'#userId' : 'userId'
						},
						ExpressionAttributeValues: {
						':projectId' :  projectList.Items[i].projectId,
						':userId' : userId
						},
					};
					console.log(taskParams);
					taskScanResult = await dynamoDb.scan(taskParams).promise();
					console.log(taskScanResult);
					projectList.Items[i].tasks=taskScanResult.Items;
					
				}
	}
			
				console.log(taskScanResult);
				console.log(projectList);
				console.log("Returning result:"+ projectList.Items);				
				return projectList.Items;			
		
}

//Deletes project based on the projectid specified
export async function deleteProject(event, context, callback) {
	const params = {
		TableName: process.env.projectstableName,
		Key: {
			projectId: event.pathParameters.id
		},
		ReturnValues: 'ALL_OLD'
	};

	try {
		const result = await dynamoDbLib.call("delete", params);
		if(result.Attributes) {		
		callback(null, success({ status: true }));
		
		const userparams = {
			TableName: process.env.userstableName,
			Key: {
				userId: event.requestContext.identity.cognitoIdentityId,
			},
			UpdateExpression: 'DELETE projectId :projectId',
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
			callback(null, failure({ status: false, error: "Failed to update project details in user table." }));
		}		
		} else {
			callback(null, failure({ status: false , error: "Unable to delete" }));
		}
	} catch (e) {
		console.log(e);
		callback(null, failure({ status: false }));
	}
}

function createTableParams(userId1,projectId1,operation){
	const docClient = new AWS.DynamoDB.DocumentClient();	
	console.log(userId1);
	console.log(projectId1);
	var projectParams;
	if(operation=="delete"){
	projectParams= {
		TableName: process.env.userstableName,
		Key: {
			userId: userId1
		},
		UpdateExpression: "DELETE projectId :projectId",
		ExpressionAttributeValues: {
				':projectId': docClient.createSet(projectId1),
			},
		};
	}else if(operation=="create") {
		 projectParams = {
		TableName: process.env.userstableName,
		Key: {
			userId: userId1
		},
		UpdateExpression: "ADD projectId :projectId",
		ExpressionAttributeValues: {
				':projectId': docClient.createSet([projectId1]),				
			},
		};
	}
	
		return projectParams;
}

async function fetcTaskDetailsAndUpdate(oldUserId,updatedUserId,projectId) {
		const dynamoDb = new AWS.DynamoDB.DocumentClient();		
		const fetchTaskIdParams = {
		TableName: process.env.taskstableName,
		FilterExpression: 'userId = :userId AND projectId = :projectId',
		ExpressionAttributeValues: {
			":userId" : oldUserId,
			":projectId" : projectId
		}
		};
		try{
		console.log(fetchTaskIdParams);
		var taskData = await dynamoDb.scan(fetchTaskIdParams).promise();
		console.log(taskData);
		var updateTaskParams;
		var taskUpdateOnProjectEditResult;
		for(var i=0;i<taskData.Count;i++){
		updateTaskParams = {
			TableName: process.env.taskstableName,			            
			Key: {
				taskId: taskData.Items[i].taskId
				},
			UpdateExpression: "SET userId = :userId",
			ExpressionAttributeValues: {
				':userId': updatedUserId
				},
			ReturnValues: 'UPDATED_NEW' 
		};
		taskUpdateOnProjectEditResult = await dynamoDbLib.call("update",updateTaskParams);
		console.log(taskUpdateOnProjectEditResult);
		}
		}catch(e){
			console.log("Failed to update Tasks");
		}
		return taskUpdateOnProjectEditResult;
		
}			
		
		
		

//Updates the project info
export async function update(event, context, callback) {
	const data = JSON.parse(event.body);	
	const docClient = new AWS.DynamoDB.DocumentClient();
	const dynamoDb = new AWS.DynamoDB.DocumentClient();		
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
			ReturnValues: 'UPDATED_OLD'			
	};

	try {
		const result = await dynamoDbLib.call("update", params);
		console.log("Edit succesfull on project table"+result);
		//Update userTable with projectId for respective Users
		console.log(result.Attributes.projectOwner+"smdbsmnd"+data.projectOwner);
		if(result.Attributes.projectOwner!==data.projectOwner) {		
		try {
		console.log("entered try");
		const deleteResult = await dynamoDbLib.call("update", createTableParams(result.Attributes.projectOwner,event.pathParameters.id,"delete"));
		console.log(deleteResult);
		const createResult = await dynamoDbLib.call("update", createTableParams(data.projectOwner,event.pathParameters.id,"create"));
		console.log(createResult);
		var taskUpdateResult = await fetcTaskDetailsAndUpdate(result.Attributes.projectOwner,data.projectOwner,event.pathParameters.id);
		} catch (e) {
		console.log(e)
		callback(null, failure({ status: false ,error:"Failed to update project owner data in user/tasks table"}));
		}
		}		
		console.log("editing contribtors in user table");
		var fetchUserProjectIdParams;
		if(data.projectContributors){
		fetchUserProjectIdParams = {
		TableName: process.env.userstableName,
		FilterExpression: 'contains (projectId, :projectId)',
		ExpressionAttributeValues: {
			":projectId" : event.pathParameters.id
		}
		};
		try {	
			console.log("kjashxkjHX"+ JSON.stringify(fetchUserProjectIdParams));
		var userData = await dynamoDb.scan(fetchUserProjectIdParams).promise();
		console.log(userData);
		var deleteContributorResult;
				for(var i=0;i<userData.Count;i++){				
				if(userData.Items[i].userId==data.projectOwner) { continue; }
				else if(userData.Items[i].userId!==data.projectOwner) {
				console.log("mhsgdmn"+JSON.stringify(createTableParams(userData.Items[i].userId,event.pathParameters.id,"delete")));
				deleteContributorResult = await dynamoDbLib.call("update",createTableParams(userData.Items[i].userId,event.pathParameters.id,"delete"));
				}}
				
				
		const iterator = data.projectContributors.entries();
		var createContributorResult;
		var taskResult;
		for (let contributorId of iterator) {
			console.log(contributorId[1]);
			createContributorResult = await dynamoDbLib.call("update", createTableParams(contributorId[1],event.pathParameters.id,"create"));	
			taskResult = fetcTaskDetailsAndUpdate(result.Attributes.projectOwner,data.projectOwner,event.pathParameters.id,"contributor");
			}
		 
			
	} catch (e) {
		console.log(e);
		callback(null, failure({ status: false , error: "Failed to update contributors data in the user table?tasks table" }));
	}
					
	callback(null, success({ status: true }));
	}
	}catch (e) {
		console.log(e)
		callback(null, failure({ status: false , error: "Failed to update user table" }));
	}
}
