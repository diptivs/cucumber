
import AWS from "aws-sdk";

import * as schedulerLib from "./libs/scheduler-lib";


/**** APIs for scheduler service ******/

//Get Schedule for given time frame
//input: GET with queryparameter: ?startDate=<>,endDate=<>
export async function getSchedule(event, context, callback) {
	try {
		const result = await schedulerLib.getSchedule(event.requestContext.identity.cognitoIdentityId, event.queryStringParameters.startDate, event.queryStringParameters.endDate);
		if (result.Item) {
			// Return the retrieved item
			callback(null, success(result.Item));
		} else {
			callback(null, failure({ status: false, error: "No tasks available."}));
		}
	} catch (e) {
		console.log(e);
		callback(null, failure({ status: false }));
	}
}

//create/update schedule
//input: POST with Request Body: { taskID:<>, taskType: N (new) / S (snooze) / C (calender)}
export async function reSchedule(event, context, callback) {
        try {
        	console.log("Enter reSchedule API");
        	console.log(event.requestContext.identity.cognitoIdentityId);
        	console.log(event);
                await schedulerLib.reSchedule("f6f4a049-039c-4cbd-a0d9-bcf2bc356ebb",event.body);
                callback(null, success({ status: true }));
        } catch (e) {
                console.log(e);
                callback(null, failure({ status: false }));
        }
}

