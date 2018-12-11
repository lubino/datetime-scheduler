const DAYS = {
    sunday: true,
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: true
};
const {sunday, monday, tuesday, wednesday, thursday, friday, saturday} = DAYS;
const KEYS = Object.keys(DAYS);
const minuteMillis = 60000;
const minimalTimeout = 30 * minuteMillis;
const active = [];
let debug = message => console.log(`scheduler: ${message}`);

async function execute(name, options) {
    debug(`Executing '${name}'`);
    const {asyncTask} = options || {};
    if (asyncTask) {
        try {
            await asyncTask();
        } catch (e) {
            debug(`Service '${name}' failed because of ${e}`);
        }
    }
}

const millisFrom = (days, hours, minutes, seconds, millis) => (((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000 + millis;

function millisToNext(now, configuration) {
    const {days, time, timestamp, interval} = configuration;
    if (interval) {
        const timespan = interval * minuteMillis;
        return timespan;
    }
    if (timestamp) {
        const timeout = timestamp - now.getTime();
        if (timeout >= 0) return timeout;
    }
    if (time) {
        const todayDay = now.getDay();
        const {hours = 0, minutes = 0, seconds = 0, millis = 0} = time;
        const inHours = hours - now.getHours();
        const inMinutes = minutes - now.getMinutes();
        const inSeconds = seconds - now.getSeconds();
        const inMillis = millis - now.getMilliseconds();
        for (let day = 0; day < 8; day++) {
            const atDay = (todayDay + day) % 7;
            if (!days || days[KEYS[atDay]] === true) {
                const timeout = millisFrom(day, inHours, inMinutes, inSeconds, inMillis);
                if (timeout >= 0) return timeout;
            }
        }
    }
    return -1;
}

function addScheduler(creatingNew, now, name, configuration, options) {
    const time = now.getTime();
    const inMillis = millisToNext(now, configuration);
    if (inMillis >= 0) {
        const at = new Date(time + inMillis);
        const index = active.length > 0 ? active.findIndex(item => at < item.at) : 0;
        active.splice(index, 0, {at, name, configuration, options});
        handleTimer(creatingNew);
    }
    return inMillis;
}

function createScheduler(name, configuration, options) {
    const now = new Date();
    const inMillis = addScheduler(true, now, name, configuration, options);
    if (inMillis >= 0) {
        const {d, h, m, s} = minutesToDaysHoursMinutesArr(inMillis);
        debug(`Scheduled job '${name}' is going to be executed in ${d} days, ${h} hours, ${m} minutes, ${s} seconds`);
    }
}

function clearScheduler(name) {
    let i = active.length;
    let modified = false;
    while (i-- > 0) {
        if (active[i].name === name) {
            active.splice(i, 1);
            modified = true;
        }
    }
    if (modified) {
        debug(`Canceling previously scheduled job '${name}'`);
        handleTimer(true);
    }
}

let timeoutReference = null;

function handleTimer(creatingNew) {
    if (timeoutReference != null) {
        clearTimeout(timeoutReference);
        timeoutReference = null;
    }
    if (active.length > 0) {
        const now = Date.now();
        const {at, name, configuration, options} = active[0];
        const suggestedTimeout = at - now;
        if (suggestedTimeout < 0) {
            active.splice(0, 1);
            execute(name, options).then(() => {
                addScheduler(false, new Date(now), name, configuration, options);
            });
        } else {
            if (!creatingNew) {
                const {d, h, m, s} = minutesToDaysHoursMinutesArr(suggestedTimeout);
                debug(`Waiting for job '${name}' to be executed in ${d} days, ${h} hours, ${m} minutes, ${s} seconds`);
            }
            const timeout = Math.min(minimalTimeout, suggestedTimeout);
            timeoutReference = setTimeout(() => {
                timeoutReference = null;
                handleTimer(false);
            }, timeout);
        }
    }
}

function minutesToDaysHoursMinutesArr(inMillis) {
    const minutes = Math.floor(inMillis / minuteMillis);
    const h = Math.floor(minutes / 60);
    const seconds = (inMillis - minutes * minuteMillis) / 1000;
    return {d: Math.floor(h / 24), h: h % 24, m: minutes % 60, s: seconds};
}

const setDebug = _debug => debug = _debug;

module.exports = {
    //Main methods:
    createScheduler, clearScheduler,

    //logger:
    setDebug,

    //days:
    sunday, monday, tuesday, wednesday, thursday, friday, saturday
};
