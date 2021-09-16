import { Component, ElementRef, ViewChild } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { Chart } from 'chart.js';

@Component({
  selector: 'app-stats',
  templateUrl: 'stats.page.html',
  styleUrls: ['stats.page.scss']
})
export class StatsPage {

  sensor: any = { temp: { min: 0, max: 50 }, hum: { min: 0, max: 100 } };
  settings: any = { temp: { set: false, min: 0, max: 0 }, hum: { set: false, min: 0, max: 0 } };
  range: any = { temp: { min: 0, max: 0 }, hum: { min: 0, max: 0 } };

  tempLast60mins_chart: any;
  humLast60mins_chart: any;

  tempToday_chart: any;
  humToday_chart: any;

  last60mins_data: any = { temp: [], hum: [] };

  today_data: any = { temp: [], hum: [] };

  api: Observable<any>;

  setintervalObj1: any = undefined;
  setintervalObj2: any = undefined;
  setintervalObj3: any = undefined;

  @ViewChild("tempStatusChip", { read: ElementRef }) tempStatusChip: ElementRef;
  @ViewChild("tempStatusLabel", { read: ElementRef }) tempStatusLabel: ElementRef;
  @ViewChild("tempValue", { read: ElementRef }) tempValue: ElementRef;
  @ViewChild("tempProgress", { read: ElementRef }) tempProgress: ElementRef;
  @ViewChild("tempRange", { read: ElementRef }) tempRange: ElementRef;
  @ViewChild("tempLast60mins", { read: ElementRef }) tempLast60mins: ElementRef;
  @ViewChild("tempToday", { read: ElementRef }) tempToday: ElementRef;

  @ViewChild("humStatusChip", { read: ElementRef }) humStatusChip: ElementRef;
  @ViewChild("humStatusLabel", { read: ElementRef }) humStatusLabel: ElementRef;
  @ViewChild("humValue", { read: ElementRef }) humValue: ElementRef;
  @ViewChild("humProgress", { read: ElementRef }) humProgress: ElementRef;
  @ViewChild("humRange", { read: ElementRef }) humRange: ElementRef;
  @ViewChild("humLast60mins", { read: ElementRef }) humLast60mins: ElementRef;
  @ViewChild("humToday", { read: ElementRef }) humToday: ElementRef;

  constructor(public httpClient: HttpClient, public toastController: ToastController) { }

  ionViewDidEnter() {
    this.getTempStatus();
    this.getHumStatus();
    this.getLive();
    this.getLast60mins(true);
    this.getToday(true);

    if (this.setintervalObj1 === undefined) {
      this.setintervalObj1 = setInterval(() => {
        this.getTempStatus();
        this.getHumStatus();
        this.getLive();
      }, 1000);
    }
    if (this.setintervalObj2 === undefined) {
      this.setintervalObj2 = setInterval(() => {
        console.log(1);
        this.getLast60mins();
        this.updateLast60minsChart();
      }, 30 * 1000);
    }
    if (this.setintervalObj3 === undefined) {
      this.setintervalObj3 = setInterval(() => {
        this.getToday();
        this.updateTodayChart();
      }, 30 * 60 * 1000);
    }
  }

  async presentToast(message, duration, color) {
    const toast = await this.toastController.create({
      message: message,
      duration: duration,
      color: color
    });
    toast.present();
  }

  getTempStatus() {
    this.api = this.httpClient.get("http://127.0.0.1:3000/api/status/temp");
    this.api.subscribe(data => {
      this.tempStatusChip.nativeElement.color = data.status ? "success" : "danger";
      this.tempStatusLabel.nativeElement.innerHTML = data.status ? "Online" : "Offline";
    }, err => {
      this.presentToast("Error occured", 500, "danger");
    });
  }

  getHumStatus() {
    this.api = this.httpClient.get("http://127.0.0.1:3000/api/status/hum");
    this.api.subscribe(data => {
      this.humStatusChip.nativeElement.color = data.status ? "success" : "danger";
      this.humStatusLabel.nativeElement.innerHTML = data.status ? "Online" : "Offline";
    }, err => {
      this.presentToast("Error occured", 500, "danger");
    });
  }

  getLive() {
    this.api = this.httpClient.get("http://127.0.0.1:3000/api/live");
    this.api.subscribe(data => {
      if (data.temp.value === undefined) {
        data.temp.value = 0;
      }
      if (!this.settings.temp.set) {
        this.settings.temp.min = data.temp.min;
        this.settings.temp.max = data.temp.max;
        this.tempRange.nativeElement.value = { lower: data.temp.min, upper: data.temp.max };
        this.settings.temp.set = true;
      }
      this.tempValue.nativeElement.innerHTML = data.temp.value + " °C";
      this.tempValue.nativeElement.color = "medium";
      this.tempProgress.nativeElement.color = "primary";
      if (data.temp.value === this.settings.temp.min || data.temp.value === this.settings.temp.max) {
        this.tempValue.nativeElement.color = "warning";
        this.tempProgress.nativeElement.color = "warning";
      }
      if (data.temp.value < this.settings.temp.min || data.temp.value > this.settings.temp.max) {
        this.tempValue.nativeElement.color = "danger";
        this.tempProgress.nativeElement.color = "danger";
      }
      let progress: any = (data.temp.value - this.sensor.temp.min) / (this.sensor.temp.max - this.sensor.temp.min);
      this.tempProgress.nativeElement.value = progress;

      if (data.hum.value === undefined) {
        data.hum.value = 0;
      }
      if (!this.settings.hum.set) {
        this.settings.hum.min = data.hum.min;
        this.settings.hum.max = data.hum.max;
        this.humRange.nativeElement.value = { lower: data.hum.min, upper: data.hum.max };
        this.settings.hum.set = true;
      }
      this.humValue.nativeElement.innerHTML = data.hum.value + " %";
      this.humValue.nativeElement.color = "medium";
      this.humProgress.nativeElement.color = "primary";
      if (data.hum.value === this.settings.hum.min || data.hum.value === this.settings.hum.max) {
        this.humValue.nativeElement.color = "warning";
        this.humProgress.nativeElement.color = "warning";
      }
      if (data.hum.value < this.settings.hum.min || data.hum.value > this.settings.hum.max) {
        this.humValue.nativeElement.color = "danger";
        this.humProgress.nativeElement.color = "danger";
      }
      progress = (data.hum.value - this.sensor.hum.min) / (this.sensor.hum.max - this.sensor.hum.min);
      this.humProgress.nativeElement.value = progress;
    }, err => {
      this.presentToast("Error occured", 500, "danger");
    });
  }

  changeTempRange(e) {
    this.range.temp.min = e.detail.value.lower;
    this.range.temp.max = e.detail.value.upper;
  }

  changeHumRange(e) {
    this.range.hum.min = e.detail.value.lower;
    this.range.hum.max = e.detail.value.upper;
  }

  resetTempRange(e) {
    this.range.temp.min = this.settings.temp.min;
    this.range.temp.max = this.settings.temp.max;
    this.tempRange.nativeElement.value = { lower: this.range.temp.min, upper: this.range.temp.max };
  }

  resetHumRange(e) {
    this.range.hum.min = this.settings.hum.min;
    this.range.hum.max = this.settings.hum.max;
    this.humRange.nativeElement.value = { lower: this.range.hum.min, upper: this.range.hum.max };
  }

  saveTempRange(e) {
    let body: any = { min: this.range.temp.min, max: this.range.temp.max };
    this.api = this.httpClient.post("http://127.0.0.1:3000/api/set/temp", body);
    this.api.subscribe(data => {
      if (data.status) {
        this.settings.temp.min = this.range.temp.min;
        this.settings.temp.max = this.range.temp.max;
        this.presentToast("Temperature range is saved", 2000, "dark");
      }
      else {
        this.presentToast("Temperature range is invalid", 2000, "danger");
      }
    }, err => {
      this.presentToast("Error occured", 500, "danger");
    });
  }

  saveHumRange(e) {
    let body: any = { min: this.range.hum.min, max: this.range.hum.max };
    this.api = this.httpClient.post("http://127.0.0.1:3000/api/set/hum", body);
    this.api.subscribe(data => {
      if (data.status) {
        this.settings.hum.min = this.range.hum.min;
        this.settings.hum.max = this.range.hum.max;
        this.presentToast("Humidity range is saved", 2000, "dark");
      }
      else {
        this.presentToast("Humidity range is invalid", 2000, "danger");
      }
    }, err => {
      this.presentToast("Error occured", 500, "danger");
    });
  }

  getLast60mins(first = false) {
    this.api = this.httpClient.get("http://127.0.0.1:3000/api/last-60-mins");
    this.api.subscribe(data => {
      this.last60mins_data = data;
      if (first) {
        this.createLast60minsChart();
      }
    }, err => {
      this.presentToast("Error occured", 500, "danger");
    });
  }

  createLast60minsChart() {
    this.tempLast60mins_chart = new Chart(this.tempLast60mins.nativeElement, {
      type: 'line',
      data: {
        labels: [...Array(60 + 1).keys()].slice(1).reverse(),
        datasets: [{
          label: 'Temperature of last 60 mins',
          fill: false,
          backgroundColor: 'rgb(45, 125, 144)',
          borderColor: 'rgb(45, 125, 144)',
          data: this.last60mins_data.temp,
          lineTension: 0
        }]
      },
      options: {
        scales: {
          yAxes: [{
            scaleLabel: {
              display: true,
              labelString: 'Temperature °C'
            },
            ticks: {
              suggestedMin: 0,
              suggestedMax: 50
            }
          }],
        }
      }
    });

    this.humLast60mins_chart = new Chart(this.humLast60mins.nativeElement, {
      type: 'line',
      data: {
        labels: [...Array(60 + 1).keys()].slice(1).reverse(),
        datasets: [{
          label: 'Humidity of last 60 mins',
          fill: false,
          backgroundColor: 'rgb(45, 125, 144)',
          borderColor: 'rgb(45, 125, 144)',
          data: this.last60mins_data.hum,
          lineTension: 0
        }]
      },
      options: {
        scales: {
          yAxes: [{
            scaleLabel: {
              display: true,
              labelString: 'Humidity %'
            },
            ticks: {
              suggestedMin: 0,
              suggestedMax: 100
            }
          }],
        }
      }
    });
  }

  updateLast60minsChart() {
    this.tempLast60mins_chart.data.datasets[0].data = this.last60mins_data.temp;
    this.humLast60mins_chart.data.datasets[0].data = this.last60mins_data.hum;
    this.tempLast60mins_chart.update();
    this.humLast60mins_chart.update();
  }

  getToday(first = false) {
    this.api = this.httpClient.get("http://127.0.0.1:3000/api/today");
    this.api.subscribe(data => {
      this.today_data = data;
      if (first) {
        this.createTodayChart();
      }
    }, err => {
      this.presentToast("Error occured", 500, "danger");
    });
  }

  createTodayChart() {
    this.tempToday_chart = new Chart(this.tempToday.nativeElement, {
      type: 'line',
      data: {
        labels: [...Array(24).keys()],
        datasets: [{
          label: 'Temperature of today',
          fill: false,
          backgroundColor: 'rgb(255, 99, 132)',
          borderColor: 'rgb(255, 99, 132)',
          data: this.today_data.temp,
          lineTension: 0
        }]
      },
      options: {
        scales: {
          yAxes: [{
            scaleLabel: {
              display: true,
              labelString: 'Temperature °C'
            },
            ticks: {
              suggestedMin: 0,
              suggestedMax: 50
            }
          }],
        }
      }
    });

    this.humToday_chart = new Chart(this.humToday.nativeElement, {
      type: 'line',
      data: {
        labels: [...Array(24).keys()],
        datasets: [{
          label: 'Humidity of today',
          fill: false,
          backgroundColor: 'rgb(255, 99, 132)',
          borderColor: 'rgb(255, 99, 132)',
          data: this.today_data.hum,
          lineTension: 0
        }]
      },
      options: {
        scales: {
          yAxes: [{
            scaleLabel: {
              display: true,
              labelString: 'Humidity %'
            },
            ticks: {
              suggestedMin: 0,
              suggestedMax: 100
            }
          }],
        }
      }
    });
  }

  updateTodayChart() {
    this.tempToday_chart.data.datasets[0].data = this.today_data.temp;
    this.humToday_chart.data.datasets[0].data = this.today_data.hum;
    this.tempToday_chart.update();
    this.humToday_chart.update();
  }

}
