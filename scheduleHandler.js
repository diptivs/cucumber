
import AWS from "aws-sdk";
import { success, failure } from "./libs/response-lib";
import * as schedulerLib from "./libs/scheduler-lib";


/**** APIs for scheduler service ******/

//Get Schedule for given time frame
//input: GET with queryparameter: ?startDate=<>,endDate=<>
export async function getSchedule(event, context, callback) {
    var create = false;
	try {
		console.log("calling getSchedule")
        if (event.queryStringParameters.create) {
            create = true;
        }
		const result = await schedulerLib.getSchedule(event.requestContext.identity.cognitoIdentityId,
                                                      event.queryStringParameters.startDate,
                                                      event.queryStringParameters.endDate,
                                                      create);
		console.log("returned from getSchedule" + result );
		console.log(result.Items);
		if (result) {
			console.log("success");
			// Return the retrieved item
			callback(null, success(result));
		} else {
			console.log("failure");
			callback(null, failure({ status: false, error: "No tasks available."}));
		}
	} catch (e) {
		console.log("exception");
		console.log(e);
		callback(null, failure({ status: false }));
	}
}

//create/update schedule
//input: POST with Request Body: { taskID:<>, taskType: N (new) / S (snooze) / C (calender)}
export async function reSchedule(event, context, callback) {
        try {
                await schedulerLib.reSchedule(event.requestContext.identity.cognitoIdentityId,event.body);
                console.log("reSchedule API success");
                callback(null, success({ status: true }));
        } catch (e) {
                console.log(e);
                callback(null, failure({ status: false }));
        }
}

