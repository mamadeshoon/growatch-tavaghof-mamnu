import { Component, ElementRef, ViewChild } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-settings',
  templateUrl: 'settings.page.html',
  styleUrls: ['settings.page.scss']
})
export class SettingsPage {

  api: Observable<any>;

  @ViewChild("phoneInput", { read: ElementRef }) phoneInput: ElementRef;

  constructor(public httpClient: HttpClient, public toastController: ToastController) { }

  ionViewDidEnter() {
    this.getPhone();
  }

  async presentToast(message, duration, color) {
    const toast = await this.toastController.create({
      message: message,
      duration: duration,
      color: color
    });
    toast.present();
  }

  getPhone() {
    this.api = this.httpClient.get("http://127.0.0.1:3000/api/settings/phone");
    this.api.subscribe(data => {
      this.phoneInput.nativeElement.value = data.phone;
    }, err => {
      this.presentToast("Error occured", 500, "danger");
    });
  }

  savePhone(e) {
    let number: any = this.phoneInput.nativeElement.value;
    this.api = this.httpClient.post("http://127.0.0.1:3000/api/settings/phone", { phone: number });
    this.api.subscribe(data => {
      if (data.status) {
        this.presentToast("Phone number is saved", 2000, "dark");
      }
      else {
        this.presentToast("Phone number is invalid", 2000, "danger");
      }
    }, err => {
      this.presentToast("Error occured", 500, "danger");
    });
  }

}
