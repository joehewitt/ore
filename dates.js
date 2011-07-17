
var monthNames = new Array("January", "February", "March", "April", "May", "June", "July", "August",
                           "September", "October", "November", "December");

var dayNames = new Array("Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday",
                         "Saturday");
   
return {
    relativeTimestamp: function(d) {
        var now = new Date();
        var yesterday = new Date(now.getTime() - 60*60*24*1000);
        if (sameDay(now, d)) {
            return 'Today';
        } else if (sameDay(yesterday, d)) {
            return 'Yesterday';
        } else if (0) {
            return dayNames[d.getDay()];
        } else {
            return monthNames[d.getMonth()] + ' ' + d.getDate() + ', ' + (1900+d.getYear());
        }
        
        function sameDay(d1, d2) {
            return d1.getYear() == d2.getYear() && d1.getMonth() == d2.getMonth()
                   && d1.getDate() == d2.getDate();
        }
    },
    
    formatTime: function(t) {
        var h = Math.floor(t/3600);

        t = t % 3600;
        
        var m = Math.floor(t / 60);
        
        var s = Math.round(t % 60);
        if (s == 60) {
            s = 0;
        }
        if (s < 10) {
            s = '0' + s;
        }
        if (h) {
            if (m < 10) {
                m = '0' + m;
            }
            return h + ':' + m + ':' + s;
        } else {
            return m + ':' + s;
        }
    }    
};
