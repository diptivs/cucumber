import uuid from "uuid";
import AWS from "aws-sdk";
import date from "date-and-time";
import config from "../config";
import * as dynamoDbLib from "./dynamodb-lib";

AWS.config.region = config.apiGateway.REGION;

const lambdaName = "pomafocus-api-" + process.env.stage;

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
        const projects = await getLambda(lambda, params);
        console.log('getLambda returned');
        console.log(projects);
        if (projects)
            return projects.Items;
        else
            return [];
    } catch (e)
    {
        console.log(e);
        return;
    }
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
                        "taskStatus":"new"
                    }
            }),
        };

        console.log("calling getTaskLambda");
        console.log(params);
        const tasks = await getLambda(lambda, params);
        console.log('getLambda returned');
        console.log(tasks);
        if (tasks)
            return tasks.Items.slice(0, numTasks);
        else
            return [];
    } catch (e)
    {
        console.log(e);
        return;
    }


}


/**
 * Function that gets specified number of top tasks within the project
 * @param projectId - id of project
 * @param numTasks - number of tasks to return for the project
 * @return array containing project ids
 */
async function getPreferencesFromDb() {
    try{
        const lambda = new AWS.Lambda();

        const params = {
            FunctionName: lambdaName + "-retrieveUserPreference"
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
async function getPreferences() {
    var preferences = await getPreferencesFromDb(),
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
    var userConfig = await getPreferences();

    var pomodoroSize = userConfig.pomodoroSize,
        shortBreakSize = userConfig.shortBreakSize,
        longBreakSize = userConfig.longBreakSize,
        freeTime = getFreeTime(userConfig, startDateStr, endDateStr),
        availPomodoros = getNumOfPomodoroSlots(pomodoroSize, shortBreakSize, longBreakSize, freeTime),
        projects = await getProjects(userId),
        schedule = [],
        tasks = [],
        taskCount = 0;

    projects.forEach(function(project){
        numOfTasks = Math.round(project.weight/100*availPomodoros.total);
        tasks = tasks.concat( getTasks(project._id, numOfTasks))
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
                taskId: task.id,
                type: 'task'
            });
            start_time = date.addMinutes(end_time, 0);
            if (taskCount<3) {
                end_time = date.addMinutes(start_time, shortBreakSize);
                schedule.push({
                    title: 'Short Break',
                    descr: 'Time to take a short break',
                    start: start_time,
                    end: end_time,
                    type: 'break'
                });
                taskCount++;
            } else {
                end_time = date.addMinutes(start_time, longBreakSize)
                schedule.push({
                    title: 'Long Break',
                    descr: 'Time to take a long break',
                    start: start_time,
                    end: end_time,
                    type: 'break'
                });
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
        flatSched.concat(day.schedule)
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
async function snoozeTask(userId, prefrences, taskId) {
    const today = date.format(new Date(), 'YYYY-MM-DD'),
          tomorrow = date.format( date.addDays(new Date(), 1), 'YYYY-MM-DD'),
          scheduleToday = await getScheduleRangeFromDB(userId, today, today),
          scheduleRest = await getScheduleRangeFromDB(userId, tomorrow);

    var schedSlicePast, schedSliceFuture,
        snoozedTask = { taskId: taskId, type: 'task' },
        schedSplitIndex = null,
        nextTask = null,
        useNextTask = false; // flag to indicate that the timeslot of next task should be used

    for(var i=0; i<scheduleToday.Items[0].schedule.length; i++){
        item = scheduleToday.Items[0].schedule[i];
        if (item.type=='task') {
            if (item.taskId==taskId) {
                useNextTask = true;
                snoozedTask.title = item.title;
                snoozedTask.desc = item.desc;
            } else if (useNextTask==true) {
                nextTask = item;
                schedSplitIndex = i;
                break;
            }
        }
    }

    if (!nextTask) {
        for (var i=0; i<scheduleRest.Items[0].schedule.length; i++) {
            item = scheduleRest.Items[0].schedule[i];
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

    snoozedTask.start = nextTask.start;
    snoozedTask.end = endTask.end;

    var endtime=snoozedTask.end,
        schedule = flattenSchedule(scheduleRest, schedSliceFuture);


    schedule.forEach(function(item, i){
        if (item.type!='task' && schedule.length>(i+1) && schedule[i+1].type=='task') {
            endtime = item.end;
        } else if (item.type=='task') {
            var length = date.subtract(new Date(item.end), new Date(item.end)).toMinutes(),
                newStart = new Date(endtime),
                newEnd = date.addMinutes(newStart, length),
                workdayEnd = new Date(endtime);
            workdayEnd.setHours(preferences.workSchedule.end.h, preferences.workSchedule.end.m);

            if ( newEnd <=workdayEnd )  {
                item.start = newStart;
            } else {
                for (n=i+1; n<schedule.length; n++) {
                    if (schedule[n].type=='task') {
                        item.start = new Date(schedule[n].start);
                        newEnd = new Date(schedule[n].end);
                        break;
                    }
                }
            }
            item.end = newEnd;
            endtime = newEnd;
        }
    });

    schedule.unshift(snoozedTask);
    schedule = schedSlicePast.concat(schedule);
    pushScheduleToDb(userId, schedule, true);
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
export async function getSchedule(userId, startDateStr, endDateStr) {
    var response = { Items: [] };
    try {
        const schedule = await getScheduleRangeFromDB(userId, startDateStr, endDateStr);

        if (schedule && schedule.Items.length) {
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
    var preferences = await getPreferences(),
        schedule = [];

    if (data.snooze) {
        schedule = await snoozeTask(userId, preferences, data.snooze);
    } else if (data.skip) {
        schedule = await skipTask(userId, data.skip);
    } else if (data.reschedule) {
        schedule = await swapTasks(userId, data.reschedule)
    }

    return schedule;
}
