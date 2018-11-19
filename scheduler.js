import uuid from "uuid";
import AWS from "AWS-sdk";
import date from "date-and-time";
import Amplify from "aws-amplify";
import config from "./config";
import API from "aws-amplify";

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

export function reschedule(event, context, callback) {
    try {
        schedule = createSchedule();
        callback(null, success(schedule));
    } catch (e) {
        callback(null, failure({status: false}));
    }
}

export function schedule(event, context, callback) {
    try {
        schedule = createSchedule();
        callback(null, success(schedule));
    } catch (e) {
        callback(null, failure({status: false}));
    }
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

