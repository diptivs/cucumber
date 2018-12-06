import uuid from "uuid";
import AWS from "aws-sdk";
import date from "date-and-time";
import moment from "moment-timezone";
import config from "../config";
import * as dynamoDbLib from "./dynamodb-lib";

AWS.config.region = config.apiGateway.REGION;

const lambdaName = "pomafocus-api-" + process.env.stage;
console.log('STAGE', process.env.stage)

const getLambda = (lambda, params) => new Promise((resolve, reject) => {
  lambda.invoke(params, (error, data) => {
    if (error) {
      reject(error);
    } else {
      resolve(data);
    }
  });
});

function taskCompare(a, b){
    if (a.start > b.start){
        return 1;
    } else {
        return -1;
    }
}
/****** Functions for schedule Table DB ******/
//Add new schedule
async function createScheduleInDB(userID, scheduleDate, schedule) {
    const params = {
        TableName: process.env.scheduletableName,
        Item: {
            userId: userID,
            scheduleDate: scheduleDate,
            schedule: schedule
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

/*
 * function to get schedule for each day in provided date range.
 * @param userId - cognito sub of user
 * @param scheduleDateStart - string containing start date
 * @param scheduleDateEnd (optional) - string containing end date, if end date
 *                                     is not passed the function will return
 *                                     schedule for all days starting from
 *                                     start date
 * @returns schedule
 */
async function getScheduleRangeFromDB(userId, scheduleDateStart, scheduleDateEnd=null) {
    var filtrs =  { ":userId": userId,
                    ":from" : scheduleDateStart },
        dbExpression = "userId = :userId and scheduleDate >= :from";

    if (scheduleDateEnd) {
        filtrs[':to'] = scheduleDateEnd;
        dbExpression = "userId = :userId and scheduleDate BETWEEN :from AND :to";
    }

    let params = {
        TableName: process.env.scheduletableName,
        KeyConditionExpression: dbExpression,
        ExpressionAttributeValues: filtrs
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
    /*var projects = await API.get("API", `/api/project?userId=${userId}`);
    if (projects)
        return projects.Items;
    else
        return [];*/
    try{
        const lambda = new AWS.Lambda();

        const params = {
            FunctionName: lambdaName + "-listProjectsForUser",
            Payload: JSON.stringify({
                    "queryStringParameters": {
                        "userId":userId
                    }
            }),
        };

        console.log("calling getProjectsLambda");
        console.log(params);
        const resp = await getLambda(lambda, params);
        const payload = JSON.parse(resp.Payload);

        console.log('getLambda returned payload', payload);
        if (payload.body)
            return JSON.parse(payload.body).Items;
    } catch (e) {
        console.log(e);
    }
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
 * function to increment task's pomodoro counter
 * @param taskId - task ID
 */
async function incrPomodoroCount(taskId) {
    console.log('calling increment');
    const lambda = new AWS.Lambda(),
          getParams = {
            FunctionName: lambdaName + "-retrieveTask",
            Payload: JSON.stringify({
                "pathParameters": { "id": taskId }
            })
          },
          postParams = {
            FunctionName: lambdaName + "-updateTask",
          };
    try {
        const resp = await getLambda(lambda, getParams),
              payload = JSON.parse(resp.Payload);
        if (payload.body) {
            var task = JSON.parse(payload.body);
            task.taskPomodoroCount++;
            console.log("Incremented", task);
            postParams.Payload = JSON.stringify({
                "body": JSON.stringify(task),
                "pathParameters": { "id": taskId }
            });
            await getLambda(lambda, postParams);
        }

    } catch (e) {
        console.log("Error while incrementing", e);
    }
}

/**
 * Function that gets specified number of top tasks within the project
 * @param projectId - id of project
 * @param numTasks - number of tasks to return for the project
 * @return array containing project ids
 */
async function getTasks(userId, projectId, numTasks) {
    /*var tasks = await API.get("API", `/api/task?projectId={projectId}&taskStatus=new`);
    if (tasks)
        return tasks.Items.slice(0, numTasks);
    else
        return [];*/
    try{
        const lambda = new AWS.Lambda();

        const params = {
            FunctionName: lambdaName + "-listTasks",
            Payload: JSON.stringify({
                    "queryStringParameters": {
                        "projectId":projectId,
                        "taskStatus":"New",
                        "userId": userId
                    }
            }),
        };

        console.log("calling getTaskLambda");
        console.log(params);
        const resp = await getLambda(lambda, params);
        const payload = JSON.parse(resp.Payload);

        console.log('getLambda returned payload', payload);
        console.log('numTasks', numTasks);
        if (payload.body)
            return JSON.parse(payload.body).Items;
            //return JSON.parse(payload.body).Items.slice(0, numTasks);
    } catch (e) {
        console.log(e);
    }
    return [];
}


/**
 * Function that gets specified number of top tasks within the project
 * @param projectId - id of project
 * @param numTasks - number of tasks to return for the project
 * @return array containing project ids
 */
async function getPreferencesFromDb(userId) {
    try{
        const lambda = new AWS.Lambda();

        const params = {
            FunctionName: lambdaName + "-retrieveUserPreference",
            Payload: JSON.stringify({
                    "queryStringParameters": {
                        "userId":userId
                    }
            }),
        };

        console.log("calling getPreferencesLambda");
        console.log(params);
        const preferences = await getLambda(lambda, params);
        console.log('getLambda returned');
        console.log(preferences);
        if (preferences)
            return preferences;
    } catch (e) {
        console.log(e);
    }
    return { Count: 0 };
}

/*
 * function that gets user preferences from db, if there is nothing in db it
 * returns default values
 * @return user pereferences object
 */
async function getPreferences(userId) {
    var preferences = await getPreferencesFromDb(userId),
        schedule = { start: { h: 9, m: 0 },
                     lunch: { start: { h: 12, m: 0 },
                              end: { h: 13, m: 0 } },
                      end: { h: 18, m: 0 } },
        userConfig = null;

    const defaultConfig = { pomodoroSize: 25,
                            shortBreakSize: 5,
                            longBreakSize: 20,
                            workSchedule: null };

    if(preferences.Count==1) {
        userConfig = preferences.Items[0];
    } else {
        userConfig = defaultConfig;
    }

    if (userConfig.workSchedule==undefined) userConfig.workSchedule = schedule;
    return userConfig;
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
        currentTime = null,
        timeSlots = [],
        dates = [],
        startDate, endDate;

    if (startDateStr == null) {
        startDate = new Date();
    } else {
        startDate = new Date(startDateStr);
        currentTime = { h: startDate.getHours(), m: startDate.getMinutes() };
    }
    if (endDateStr == null) endDate = new Date();
    else endDate = new Date(endDateStr);

    if (startDate.getHours() > schedule.end.h || startDate.getHours()==0) startDate = date.addDays(startDate, 1);

    if (userConfig.workSchedule!=undefined) schedule = userConfig.workSchedule;
    dates = getDates(startDate, endDate);

    dates.forEach(function(d, i){
        var tslot = null, start = schedule.start;
        if (i==0 && currentTime &&
            ( currentTime.h>schedule.start.h ||
              ( currentTime.h==schedule.start.h &&
                currentTime.m>schedule.start.m )) &&
            currentTime.h < schedule.end.h){
            start = currentTime;
        }

        if (schedule.lunch!=undefined) {
            tslot = getTimeSlot(d, start, schedule.lunch.start);
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
            tslot = getTimeSlot(d, start, schedule.endDateStr);
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
async function pushScheduleToDb(userId, schedule, update=false) {
    var entries = { };

    schedule.forEach(function(task) {
        var day = new Date(task.start),
            key = date.format(day, 'YYYY-MM-DD');

        if (!entries.hasOwnProperty(key)) {
            entries[key] = [];
        }
        entries[key].push(task);
    });

    Object.keys(entries).forEach(function(key){
        if (update) {
            updateScheduleInDB(userId, key, entries[key]);
        } else {
            createScheduleInDB(userId, key, entries[key]);
        }
    });
}



/**
 * function creates schedule and returns it
 */
async function createSchedule(userId, startDateStr=null, endDateStr=null) {
    var userConfig = await getPreferences(userId);

    var pomodoroSize = userConfig.pomodoroSize,
        shortBreakSize = userConfig.shortBreakSize,
        longBreakSize = userConfig.longBreakSize,
        freeTime = getFreeTime(userConfig, startDateStr, endDateStr),
        availPomodoros = getNumOfPomodoroSlots(pomodoroSize, shortBreakSize, longBreakSize, freeTime),
        projects = await getProjects(userId),
        schedule = [],
        tasks = [],
        taskCount = 0;

    for (const project of projects) {
        var numOfTasks = Math.round(project.weight/100*availPomodoros.total);
        var retTasks = await getTasks(userId, project.projectId, numOfTasks);
        tasks = tasks.concat( retTasks );
    }

    availPomodoros.slots.forEach(function(timeslot, n) {
        var start_time = timeslot.start,
            tasksForSlot = tasks.slice(0, timeslot.count);
        tasks = tasks.slice(timeslot.count);

        if (timeslot.type !== 'free') {
            if (timeslot.type=="lunch") taskCount = 0;

            timeslot.start = timeslot.start.toISOString();
            timeslot.end = timeslot.end.toISOString();
            schedule.push(timeslot);
            return;
        }

        tasksForSlot.forEach(function(task){
            var end_time = date.addMinutes(start_time, pomodoroSize);
            schedule.push({
                title: task.taskName,
                desc: task.taskDescription,
                start: start_time.toISOString(),
                end: end_time.toISOString(),
                taskId: task.taskId,
                type: 'task',
                projectId: task.projectId
            });
            start_time = date.addMinutes(end_time, 0);
            if (taskCount<3) {
                end_time = date.addMinutes(start_time, shortBreakSize);
                /*
                schedule.push({
                    title: 'Short Break',
                    descr: 'Time to take a short break',
                    start: start_time.toISOString(),
                    end: end_time.toISOString(),
                    type: 'break'
                });
                */
                taskCount++;
            } else {
                end_time = date.addMinutes(start_time, longBreakSize)
                /*
                schedule.push({
                    title: 'Long Break',
                    descr: 'Time to take a long break',
                    start: start_time.toISOString(),
                    end: end_time.toISOString(),
                    type: 'break'
                });
                */
                taskCount=0;
            }
            start_time = end_time;
        });
    });
    pushScheduleToDb(userId, schedule);
    return schedule;
}

/*
 * function that takes daily schedule as an input and converts it to an array
 * of tasks
 * @param schedule - daily schedule, response from `getScheduleRangeFromDB`
 * @param prefix - (optional) array of tasks that precede the values in
 *                            `schedule`
 * @returns array of tasks
 */
function flattenSchedule(schedule, prefix=null) {

    var flatSched = [];

    schedule.Items.forEach(function(day){
        flatSched = flatSched.concat(day.schedule);
    });

    if (prefix) {
        flatSched = prefix.concat(flatSched);
    }

    return flatSched;
}

/*
 * function that perform rescheduling to allow additional pomodoro cycle for
 * provided task
 * @param userId - congito sub of the user
 * @param perferences - user preferences
 * @param taskId - id of the task to snooze
 * @return schedule
 */
async function snoozeTask(userId, preferences, taskId) {
    console.log("In snooze")
    const today = moment(new Date()).tz("America/Los_Angeles").format('YYYY-MM-DD'),
          tomorrow = moment( date.addDays(new Date(), 1) ).tz("America/Los_Angeles").format('YYYY-MM-DD'),
          scheduleToday = await getScheduleRangeFromDB(userId, today, today),
          scheduleRest = await getScheduleRangeFromDB(userId, tomorrow);

    console.log("DAY", today, tomorrow);
    var schedSlicePast, schedSliceFuture, endtime,
        snoozedTask = { taskId: taskId, type: 'task' },
        schedSplitIndex = null,
        nextTask = null,
        taskCount = 0,
        useNextTask = false; // flag to indicate that the timeslot of next task should be used

    scheduleToday.Items.sort(taskCompare);
    scheduleRest.Items.sort(taskCompare);
    for(var i=0; i<scheduleToday.Items[0].schedule.length; i++){
        var item = scheduleToday.Items[0].schedule[i];
        if (item.type=='task') {
            if (taskCount>3) taskCount=0;
            taskCount++;

            if (item.taskId==taskId) {
                useNextTask = true;
                snoozedTask = JSON.parse(JSON.stringify(item));
            } else if (useNextTask==true) {
                nextTask = item;
                schedSplitIndex = i;
                break;
            }
        }
    }

    // If snoozed task is last in the day
    if (!nextTask) {
        for (var i=0; i<scheduleRest.Items[0].schedule.length; i++) {
            var item = scheduleRest.Items[0].schedule[i];
            if (taskCount>3) taskCount=0;
            taskCount++;

            if (item.type=='task') {
                schedSplitIndex = i;
                nextTask = item;
                break;
            }

        }
        schedSlicePast = scheduleRest.Items[0].schedule.slice(0, schedSplitIndex);
        schedSliceFuture = scheduleRest.Items[0].schedule.slice(schedSplitIndex);
        scheduleRest.Items.splice(0, 1);
    } else {
        schedSlicePast = scheduleToday.Items[0].schedule.slice(0, schedSplitIndex);
        schedSliceFuture = scheduleToday.Items[0].schedule.slice(schedSplitIndex);
    }


    // if even tomorrow there are no tasks
    if (!nextTask) {
        schedSlicePast = scheduleToday.Items[0].schedule;
        var schedule = flattenSchedule(scheduleRest);
        schedule.unshift(snoozedTask)
    } else {
        var schedule = flattenSchedule(scheduleRest, schedSliceFuture);
        snoozedTask.start = nextTask.start;
        snoozedTask.end = nextTask.end;
    }
    taskCount++;

    console.log(taskCount);
    if (taskCount < 3) {
        console.log( "short");
        endtime = date.addMinutes(new Date(snoozedTask.end), preferences.shortBreakSize);
    } else {
        console.log("long");
        endtime = date.addMinutes(new Date(snoozedTask.end), preferences.longBreakSize);
        taskCount = 0;
    }

    schedule.forEach(function(item, i){
        if (item.type!='task') {
            if ( new Date(endtime) < new Date(item.end) ) endtime = item.end;
            taskCount = 0;
        } else {
            taskCount++;
            var tmptime = new Date(endtime),
                length = date.subtract(new Date(item.end), new Date(item.start)).toMinutes();

            if (schedule.length > i + 1 && schedule[i + 1].type != 'task') {
                if (date.addMinutes(tmptime, length) > new Date(schedule[i + 1].start))
                    endtime = new Date(schedule[i + 1].end);
            }

            var newStart = new Date(endtime),
                newEnd = date.addMinutes(newStart, length),
                workdayEnd = new Date(endtime);
            workdayEnd.setHours(preferences.workSchedule.end.h, preferences.workSchedule.end.m);

            if ( newEnd <=workdayEnd )  {
                item.start = newStart.toISOString();
            } else {
                taskCount = 0;
                for (var n=i+1; n<schedule.length; n++) {
                    if (schedule[n].type=='task') {
                         item.start = new Date(schedule[n].start);
                        item.start = item.start.toISOString();
                        newEnd = new Date(schedule[n].end);
                        break;
                    }
                }
            }
            item.end = newEnd.toISOString();
            if (taskCount < 3) {
                endtime = date.addMinutes(newEnd, preferences.shortBreakSize);
            } else {
                endtime = date.addMinutes(newEnd, preferences.longBreakSize);
            }
        }
    });

    // prepend snooze task if there are other tasks after
    if (nextTask) schedule.unshift(snoozedTask);
    schedule = schedSlicePast.concat(schedule);
    pushScheduleToDb(userId, schedule);
    console.log("Pushed to db")
    incrPomodoroCount(taskId);
    return schedule;
}

async function skipTask(userId, taskId) {
    const today = date.format(new Date(), 'YYYY-MM-DD'),
          tomorrow = date.format( date.addDays(new Date(), 1), 'YYYY-MM-DD'),
          scheduleToday = await getScheduleRangeFromDB(userId, today, today),
          scheduleRest = await getScheduleRangeFromDB(userId, tomorrow);

    var skippedTask = null;
        schedSplitIndex = null,
        useNextTask = false; // flag to indicate that the timeslot of next task should be used

    for(var i=0; i<scheduleToday.Items[0].schedule.length; i++){
        var item = scheduleToday.Items[0].schedule[i];
        if (item.type=='task') {
            if (item.taskId==taskId) {
                useNextTask = true;
                skippedTask = item;
                schedSplitIndex = i;
                break
            }
        }
    }

    var schedSlicePast = scheduleToday.Items[0].schedule.slice(0, schedSplitIndex),
        schedSliceFuture = scheduleToday.Items[0].schedule.slice(schedSplitIndex+1),
        start=skippedTask.start
        end=skippedTask.end,
        schedule = flattenSchedule(scheduleRest, schedSliceFuture);

    for (var i=0; i<schedule.length; i++) {
        var item = schedule[i];
        if (item.type=='task') {
            var newStart = new Date(start),
                newEnd = new Date(end),

            start = item.start;
            end = item.end;
            item.start = newStart;
            item.end = newEnd;

            if (item.projectId != skippedTask.projectId) {
                skippedTask.start = start;
                skippedTask.end = end;
                break;
            }
        }
    }

    schedule.unshift(skippedTask);
    schedule = schedSlicePast.concat(schedule);
    schedule.sort(taskCompare);
    pushScheduleToDb(userId, schedule, true);
    return schedule;

}

/*
 * function that swappes tasks in the schedule
 *
 */
async function swapTasks(userId, resched) {
    const itemDate = date.format(new Date(resched.start), 'YYYY-MM-DD'),
          scheduleDaily = await getScheduleRangeFromDB(userId, itemDate),
          itemLength = date.subtract(new Date(resched.end), new Date(resched.start)).toMinutes();
    var reorg = false,
        schedule = flattenSchedule(scheduleDaily),
        moveItem = null,
        oldStart = null,
        oldEnd = null,
        newIndex = null,
        oldIndex = null;

    schedule.forEach(function(item, i){
        if (item.start>=resched.start&&item.end<=resched.end&&item.type=='task'&&!moveItem) {
            moveItem = item;
            newIndex = i
        }
        if (resched.taskId!=undefined&&item.taskId!=undefined&&resched.taskId==item.taskId) {
            resched.title = item.title;
            resched.desc = item.desc;
            oldStart = item.start;
            oldEnd = item.end;
            oldIndex = i;
        }
    });
    moveItem.start = oldStart;
    moveItem.end = oldEnd;
    schedule[newIndex] = resched;
    schedule[oldIndex] = moveItem;
    pushScheduleToDb(userId, schedule, true);
    return schedule;
}

/*
 * function that returns schedule. it first looks in db, if nothing present
 * then it calls createSchedule that writes new schedule to db.
 *
 */
export async function getSchedule(userId, startDateStr, endDateStr, create=false) {
    var response = { Items: [] },
        startDate = date.format(new Date(startDateStr), 'YYYY-MM-DD'),
        endDate = date.format(new Date(endDateStr), 'YYYY-MM-DD');
    try {
        const schedule = await getScheduleRangeFromDB(userId, startDate, endDate);
        if (schedule && schedule.Items.length && !create) {
            response.Items = flattenSchedule(schedule);
        } else {
            response.Items = await createSchedule(userId, startDateStr, endDateStr);
        }
    } catch (e) {
        console.log(e);
    }
    return response;
}

/*
 * function that performs rescheduling
 * @param userId - cognito sub for user
 * @param data - POST body containing one of the following:
 *               { snooze: <taskId> },
 *               { skip: <taskId> },
 *               { reschedule: { taskId: <taskId>,
 *                               start: <startTime>,
 *                               end: <endtime> }}
 * @returns - schedule
 */
export async function reSchedule(userId, data)
{
    console.log("Enter reSchedule function");
    console.log("ARGS", userId, data);
    var preferences = await getPreferences(userId),
        response = { Items: [] };

    if (data.snooze) {
        response.Items = await snoozeTask(userId, preferences, data.snooze);
    } else if (data.skip) {
        response.Items = await skipTask(userId, data.skip);
    } else if (data.reschedule) {
        response.Items = await swapTasks(userId, data.reschedule)
    }

    return response;
}
