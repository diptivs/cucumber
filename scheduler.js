import uuid from "uuid";
import AWS from "AWS-sdk";
import date from "date-and-time";

AWS.config.update({ region: "us-west-1" });
const dynamoDB = new AWS.DynamoDB.DocumentClient();

export function prepareSchedule(event, context, callback) {

}

/**
 *    Function to get all projects that user is working on
 */
function getProjects() {
    //TODO: add code to query db for projects
    return [{ _id: 1, weight: 20},
            { _id: 2, weight: 20},
            { _id: 3, weight: 10},
            { _id: 4, weight: 50}];
}

/**
 * Function to get max number of pomodoros for each free range and total number
 * of pomodoros that can be performed.
 *
 * @param pomodoro_size - Size of single pomodoro
 * @param short_break_size - Size of short break
 * @param long_break_size - Size of long break
 * @param free_time - output of getFreeTime() function
 * @return object containing total number of pomodoros as well as number for
 *         each free slot
 */
function getNumOfPomodoroSlots(pomodoro_size, short_break_size, long_break_size, free_time) {
    var total_slots = 0,
        pomodoro_size = pomodoro_size + short_break_size + Math.floor(long_break_size/4),
        slots = [];

    free_time.forEach(function(range){
        if (range.type==='free') {
            num_of_slots = Math.floor((range.end - range.start)/(1000*60*pomodoro_size));
            total_slots += num_of_slots;
            slots.push({count: num_of_slots, start: range.start, end: range.end});
        } else {
            slots.push({count: 0, start: range.start, end: range.end});
        }
    });

    return {total: total_slots, slots: slots};
}

/**
 * Function that gets specified number of top tasks within the project
 * @param project_id - id of project
 * @param num_tasks - number of tasks to return for the project
 * @return array containing project ids
 */
function getTasks(project_id, num_tasks) {

}

/**
 * function returns slots of time available for pomodoro scheduling
 * @return array containing slot objects
 */
function getFreeTime() {
    /* TODO: add logic to query user's data and check what are free slots
        get user preferences,
        remove lunch time -> use lunch time as very long break
        get meetings for the day.
    */

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
    // TODO: get pomodoro configuration from database
    var pomodoro_size = 25,
        short_break_size=5,
        long_break_size=20,
        free_time = getFreeTime(),
        avail_pomodoros = getNumOfPomodoroSlots(pomodoro_size, short_break_size, long_break_size, free_time),
        projects = getProjects();
        schedule = [],
        tasks = [],
        slot = 0;

    projects.forEach(function(project){
        num_of_tasks = Math.round(project.weight/100*avail_pomodoros.total);
        tasks = tasks.concat(getTasks(project._id, num_of_tasks))
    });

    var start_time = date.addMinutes(free_time[slot].start, 0);
    tasks.forEach(function(task){
        end_time = date.addMinutes(start_time, pomodoro_size);
        schedule.push({
            title: task.name,
            desc: task.description,
            start: start_time,
            end: end_time
        });
        start_time = date.addMinutes(end_time, 0);
        if (i>4) {
            end_time = date.addMinutes(start_time, short_break_size);
            schedule.push({
                title: 'Short Break',
                descr: 'Time to take a short break',
                start: start_time,
                end: end_time
            });
        } else {
            end_time = date.addMinutes(start_time, long_break_size)
            schedule.push({
                title: 'Long Break',
                descr: 'Time to take a long break',
                start: start_time,
                end: end_time
            });
        }
        start_time = end_time;
    });

    return schedule;
}


