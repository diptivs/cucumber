
import AWS from "aws-sdk";
import { success, failure } from "./libs/response-lib";
import * as schedulerLib from "./libs/scheduler-lib";


/**** APIs for scheduler service ******/

//Get Schedule for given time frame
//input: GET with queryparameter: ?startDate=<>,endDate=<>
export async function getSchedule(event, context, callback) {
	try {
		console.log(event);
		const result = await schedulerLib.getSchedule(event.requestContext.identity.cognitoIdentityId, event.queryStringParameters.startDate, event.queryStringParameters.endDate);
		if (result) {
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
                await schedulerLib.reSchedule(event.requestContext.identity.cognitoIdentityId,event.body);
                callback(null, success({ status: true }));
        } catch (e) {
                console.log(e);
                callback(null, failure({ status: false }));
        }
}

