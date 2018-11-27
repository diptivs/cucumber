import uuid from "uuid";
import AWS from "AWS-sdk";
import date from "date-and-time";
import Amplify from "aws-amplify";
import config from "../config";
import API from "aws-amplify";
import * as dynamoDbLib from "./dynamodb-lib";


AWS.config.update({ region: "us-west-1" });

Amplify.configure({
	API: {
		endpoints: [
			{
				name: "API",
				endpoint: config.apiGateway.URL,
				region: config.apiGateway.REGION
			},
		]
	}
});


/****** Functions for schedule Table DB ******/
//Add new schedule
async function createScheduleInDB(userID, scheduleDate, schedule) {
    const docClient = new AWS.DynamoDB.DocumentClient();
    const params = {
        TableName: process.env.scheduletableName,
        Item: {
            userId: userID,
            scheduleDate: scheduleDate,
            schedule: docClient.createList(schedule)      
        }
    };
    try {
        await dynamoDbLib.call("put", params);
        return;
    } catch (e) {
        console.log(e);
        return;
    }
}


//getSchedule for a user
async function getUserScheduleFromDB(userID) {
    const params = {
        TableName: process.env.scheduletableName,
        Key: {
            userId: userID
        }
    };
    try {
        const result = await dynamoDbLib.call("get", params);
        if (result.Item) {
        // Return the retrieved item
        return result.Item;
        } else {
            console.log("Item Not Found");
            return null;
        }
    } catch (e) {
        console.log(e);
        return null;
    }
}

//getSchedule for a date range
async function getScheduleRangeFromDB(userId, scheduleDateStart, scheduleDateEnd) {
    let params = {
        TableName: process.env.scheduletableName,
        KeyConditionExpression:"userId = :userId and scheduleDate BETWEEN :from AND :to",
        FilterExpression : 'scheduleDate between :val1 and :val2',
        ExpressionAttributeValues : {
            ":userId": userId,
            ":from" : scheduleDateStart,
            ":to" : scheduleDateEnd
        }
    };

    try {       
        const result = await dynamoDbLib.call("query", params);
        return result;
    } catch (e) {
        console.log(e);
        return null;
    }
}

//update schedule
async function updateScheduleInDB(userID, scheduleDate, schedule) {
    let params = {
        TableName: process.env.scheduletableName,
        Key: {
            "eventId": eventId
        },
        UpdateExpression: "set schedule = :schedule",
        FilterExpression: "scheduleDate = :scheduleDate",
        ExpressionAttributeValues : {
            ":schedule": schedule,
            ":scheduleDate": scheduleDate
        },
        ReturnValues:"UPDATED_NEW"
    };

    try {       
        const result = await dynamoDbLib.call("update", params);
        return result;
    } catch (e) {
        console.log(e);
        return null;
    }
}


/**********************END of DB functions *****************************/

/**
*   Function to get schedule 
*/
export function getSchedule(userId, startDate, endDate)
{
    result = getScheduleRangeFromDB(userId, startDate, endDate);
    if(result)
    {
        console.log(result);
    } else {
        return null;
    }
}

export function reSchedule(userID,data)
{
    console.log("Enter reSchedule function");
    if(!userID)
        return null;
    var schedule = [];
    schedule.push({
                title: "test1",
                desc: "test1.task.description",
                start: "2018-12-01T09:00:00.000Z",
                end: "2018-12-01T09:25:00.000Z",
                taskId: "task1.id"
            });
    schedule.push({
                title: "test2",
                desc: "test2.task.description",
                start: "2018-12-01T09:25:00.000Z",
                end: " 2018-12-01T09:30:00.000Z",
                taskId: "task2.id"
            });

    createScheduleInDB(userID, "2018-12-01", schedule);
}


/**
 *    Function to get all projects that user is working on
 */
function getProjects(userID) {
    //TODO: Current API is using Body for GET. Needs fix. Update this call as per next design of API.
    // projects should not be complete

    return API.get("API", `/api/project?${userID}`);

   /* return [{ _id: 1, weight: 20},
            { _id: 2, weight: 20},
            { _id: 3, weight: 10},
            { _id: 4, weight: 50}];*/
}

/**
 * Function to get max number of pomodoros for each free range and total number
 * of pomodoros that can be performed.
 *
 * @param pomodoroSize - Size of single pomodoro
 * @param shortBreakSize - Size of short break
 * @param longBreakSize - Size of long break
 * @param freeTime - output of getFreeTime() function
 * @return object containing total number of pomodoros as well as number for
 *         each free slot
 */
function getNumOfPomodoroSlots(pomodoroSize, shortBreakSize, longBreakSize, freeTime) {
    var totalSlots = 0,
        pomodoroSize = pomodoroSize + shortBreakSize + Math.floor(longBreakSize/4),
        slots = [];

    freeTime.forEach(function(range){
        if (range.type==='free') {
            num_of_slots = Math.floor((range.end - range.start)/(1000*60*pomodoroSize));
            totalSlots += num_of_slots;
            slots.push({count: num_of_slots, start: range.start, end: range.end});
        } else {
            slots.push({count: 0, start: range.start, end: range.end});
        }
    });

    return {total: totalSlots, slots: slots};
}

/**
 * Function that gets specified number of top tasks within the project
 * @param projectId - id of project
 * @param numTasks - number of tasks to return for the project
 * @return array containing project ids
 */
function getTasks(projectId, numTasks) {
    // TODO: get tasks from db, tasks should not be in complete state
    //       or blocked state
    //       get tasks based on order /priority
    return [{name: "Test task", description: "test description"},
            {name: "Test task 2", description: "test description2"}]
}

/**
 * function returns slots of time available for pomodoro scheduling
 * @return array containing slot objects
 */
function getFreeTime(userConfig, startDate, endDate) {
    /* TODO: add logic to get meetings for the day.
    */
    if (startDate == null) startDate = new Date();

    if (userConfig.workSchedule!=undefined)

    return [{start: new Date('2018-12-1 09:00:00'),
             end: new Date('2018-12-1 12:00:00'),
             type: 'free'},
            {start: new Date('2018-12-1 12:00:00'),
             end: new Date('2018-12-1 13:00:00'),
             type: 'lunch'},
            {start: new Date('2018-12-1 13:00:00'),
             end: new Date('2018-12-1 18:00:00'),
             type: 'free'}]
}

/**
 * function creates schedule and returns it
 */
function createSchedule() {
    const userConfig = API.get("API",`/api/preference?${userID}`);

    const { prefPomodoroCount, prefShortBreakSize, prefLongBreakSize, prefWorkSchedule } = note;

    var pomodoroSize = prefPomodoroCount,
        shortBreakSize=prefShortBreakSize,
        longBreakSize=prefLongBreakSize,
        freeTime = getFreeTime(),
        availPomodoros = getNumOfPomodoroSlots(pomodoroSize, shortBreakSize, longBreakSize, freeTime),
        projects = getProjects();
        schedule = [],
        tasks = [],
        taskCount = 0;

    projects.forEach(function(project){
        numOfTasks = Math.round(project.weight/100*availPomodoros.total);
        tasks = tasks.concat(getTasks(project._id, numOfTasks))
    });

    availPomodoros.slots.forEach(function(timeslot, n) {
        var start_time = timeslot.start,
            tasksForSlot = tasks.slice(0, timeslot.count);
        tasks = tasks.slice(timeslot.count);

        if (timeslot.type !== 'free') {
            schedule.push(timeslot);
            return;
        }

        tasksForSlot.forEach(function(task){
            end_time = date.addMinutes(start_time, pomodoroSize);
            schedule.push({
                title: task.name,
                desc: task.description,
                start: start_time,
                end: end_time,
                taskId: task.id
            });
            start_time = date.addMinutes(end_time, 0);
            if (taskCount<3) {
                end_time = date.addMinutes(start_time, shortBreakSize);
                schedule.push({
                    title: 'Short Break',
                    descr: 'Time to take a short break',
                    start: start_time,
                    end: end_time
                });
                taskCount++;
            } else {
                end_time = date.addMinutes(start_time, longBreakSize)
                schedule.push({
                    title: 'Long Break',
                    descr: 'Time to take a long break',
                    start: start_time,
                    end: end_time
                });
                taskCount=0;
            }
            start_time = end_time;
        });
    });
    return schedule;
}

