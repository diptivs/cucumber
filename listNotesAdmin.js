import uuid from "uuid";
import AWS from "aws-sdk";
import { success, failure } from "./libs/response-lib";


const dynamoDb = new AWS.DynamoDB.DocumentClient();


export function main(event, context, callback) {
	let params = {
		TableName: process.env.tableName,
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