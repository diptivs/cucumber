import uuid from "uuid";
import AWS from "aws-sdk";
import date from "date-and-time";
import Amplify from "aws-amplify";
import config from "../config";
import API from "@aws-amplify/api";
import * as dynamoDbLib from "./dynamodb-lib";


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
    const params = {
        TableName: process.env.scheduletableName,
        Item: {
            userId: userID,
            scheduleDate: scheduleDate,
            schedule : {'L': schedule}
        }
    };

    return await dynamoDbLib.call("put", params);

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
        ExpressionAttributeValues : {
            ":userId": userId,
            ":from" : scheduleDateStart,
            ":to" : scheduleDateEnd
        }
    };
    console.log(params);
    try {
        console.log("Querying dynamo")
        const result = await dynamoDbLib.call("query", params);
        if (result) {
            console.log('done')
            console.log(result);
            return result;
        } else {
            return null;
        }
    } catch (e) {
        console.log(e);
        return;
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
        return await dynamoDbLib.call("update", params);
    } catch (e) {
        console.log(e);
        return null;
    }
}


/**********************END of DB functions *****************************/


/**
 * Function to get all projects that user is working on
 * @param userId - congito generated user sub
 * @return array of project objects
 */
async function getProjects(userId) {
    var projects = await API.get("API", `/api/project?userId=${userId}`);
    if (projects)
        return projects.Items;
    else
        return [];
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
        var num_of_slots = null;
        if (range.type==='free') {
            num_of_slots = Math.floor((range.end - range.start)/(1000*60*pomodoroSize));
            totalSlots += num_of_slots;
            range['count'] = num_of_slots;
        }
        slots.push(range);
    });

    return {total: totalSlots, slots: slots};
}

/**
 * Function that gets specified number of top tasks within the project
 * @param projectId - id of project
 * @param numTasks - number of tasks to return for the project
 * @return array containing project ids
 */
async function getTasks(projectId, numTasks) {
    var tasks = await API.get("API", `/api/task?projectId={projectId}&taskStatus=new`);
    if (tasks)
        return tasks.Items.slice(0, numTasks);
    else
        return [];
}

/**
 * Function to generate array of dates from date range
 * @param startDate - start date Date object
 * @param endDate - end date Date object
 * @return array containing dates
 */
function getDates(startDate, endDate) {
    var dates = [];
    var currentDate = startDate;
    while(currentDate <= endDate) {
        dates.push( new Date(currentDate));
        currentDate = date.addDays(currentDate, 1);
    }
    return dates;
}


/**
 * function to get timeslot object for given date.
 * @param day - Date object
 * @param start - start time, object containing h,m keys with int values
 * @param end - end time, object containing h,m keys with int values
 * @return object containing start and end Date objects
 */
function getTimeSlot(day, start, end) {
    var dSt = new Date(day),
        dEnd = new Date(day);
    dSt.setHours(start.h, start.m);
    dEnd.setHours(end.h, end.m);
    return {start: dSt, end: dEnd};
}

/**
 * function returns slots of time available for pomodoro scheduling
 * @return array containing slot objects
 */
function getFreeTime(userConfig, startDateStr, endDateStr) {
    /* TODO: add logic to get meetings for the day. */
    var schedule = { start: { h: 9, m: 0 },
                     lunch: { start: { h: 12, m: 0 },
                              end: { h: 13, m: 0 } },
                      end: { h: 18, m: 0 } },
        timeSlots = [],
        dates = [],
        startDate, endDate;

    if (startDateStr == null) startDate = new Date();
    else startDate = new Date(startDateStr);
    if (endDateStr == null) endDate = new Date();
    else endDate = new Date(endDateStr);

    if (userConfig.workSchedule!=undefined) schedule = userConfig.workSchedule;
    dates = getDates(startDate, endDate);

    dates.forEach(function(d){
        var tslot = null;
        if (schedule.lunch!=undefined) {
            tslot = getTimeSlot(d, schedule.start, schedule.lunch.start);
            tslot.type = "free";
            timeSlots.push(tslot);
            tslot = getTimeSlot(d, schedule.lunch.start, schedule.lunch.end);
            tslot.type = "lunch";
            tslot.title = "Lunch";
            timeSlots.push(tslot);
            tslot = getTimeSlot(d, schedule.lunch.end, schedule.end);
            tslot.type = "free";
            timeSlots.push(tslot);
        } else {
            tslot = getTimeSlot(d, schedule.start, schedule.endDateStr);
            tslot.type = "free";
            timeSlots.push(tslot);
        }
    });

    return timeSlots;
}

/*
 * function to convert schedule into daily object and push each object to db
 * @param schedule - schedule array generated by `createSchedule` function
 */
async function pushScheduleToDb(userId, schedule) {
    var entries = { };

    schedule.forEach(function(task) {
        var day = new Date(task.start),
            key = date.format(day, 'YYYY-MM-DD');

        if (!entries.hasOwnProperty(key)) {
            entries[key] = []
        }
        entries[key].push(task)
    });

    Object.keys(entries).forEach(function(key){
        await createScheduleInDB(userId, date.format(day, 'YYYY-MM-DD', entries))
    })
}

/**
 * function creates schedule and returns it
 */
async function createSchedule(userId, startDateStr=null, endDateStr=null) {
    var preferences = await API.get("API",`/api/preference`),
        userConfig = null;
    const defaultConfig = { prefPomodoroSize: 25,
                            prefShortBreakSize: 5,
                            prefLongBreakSize: 20,
                            prefWorkSchedule: null };

    if(preferences.Count==1) {
        userConfig = preferences.Items[0];
    } else {
        userConfig = defaultConfig;
    }

    var pomodoroSize = userConfig.prefPomodoroSize,
        shortBreakSize = userConfig.prefShortBreakSize,
        longBreakSize = userConfig.prefLongBreakSize,
        freeTime = getFreeTime(userConfig, startDateStr, endDateStr),
        availPomodoros = getNumOfPomodoroSlots(pomodoroSize, shortBreakSize, longBreakSize, freeTime),
        projects = await getProjects(userId),
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
    pushScheduleToDb(userId, schedul);
    return schedule;
}

/*
 * function that returns schedule. it first looks in db, if nothing present
 * then it calls createSchedule that writes new schedule to db.
 *
 */
export async function getSchedule(userId, startDateStr, endDateStr) {
    var response = { Items: [] };
    try {
        const schedule = await getScheduleRangeFromDB(userId, startDateStr, endDateStr);

        if (schedule && schedule.Items.length) {
            schedule.Items.forEach(function(day){
                response.Items.concat(day.schedule)
            });

        } else {
            response.Items = await createSchedule(userId, startDateStr, endDateStr);
        }
    } catch (e) {
        console.log(e);
    }
    return response;
}

export async function reSchedule(userID,data)
{
    console.log("Enter reSchedule function");

    var schedule = [];

    schedule.push({
                "title": "test1",
                "desc": "test1.task.description",
                "start": "2018-12-01T09:00:00.000Z",
                "end": "2018-12-01T09:25:00.000Z",
                "taskId": "task1.id"
            });
    schedule.push({
                "title": "test2",
                "desc": "test2.task.description",
                "start": "2018-12-01T09:25:00.000Z",
                "end": " 2018-12-01T09:30:00.000Z",
                "taskId": "task2.id"
            });

    //return createScheduleInDB(userID, scheduleDay, schedule);
    return await createScheduleInDB("USER-SUB-102", "2018-12-11", schedule);
}
