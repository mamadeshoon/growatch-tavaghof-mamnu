/*
  GROWatch
  
  IoT Based GreenHouse
  Using NodeMCU(Arduino) + MQTT Network Protocol
--------------------------------------------------------------------------
  INSTALL CH340 DRIVER ON YOU DEVICE
  DOWNLOAD NODEMCU LIBRARIES AT :
  https://arduino.esp8266.com/stable/package_esp8266com_index.json
  BAUD RATE : 9600
  *** Read instructions at README.txt to start server 
  *** Read instructions at README.txt to open Website
  *** ADRESS:\GROWatch\Codes\WebSite-NodeJS Code\r\README.txt
--------------------------------------------------------------------------
  Date : 3/18/2021
  By : Arvin Delavari , Mohammad Arman Yazdi ,
       Faraz Ghoreyshi , Mohammad Mahdi Shokrani ,.
       
  Electrical Engineering Department of :
  Iran University of Science and Technology
  
*/

// Libraries
//------------------------------------------------------------------------
#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <dht.h>
#include "DHT.h"
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

dht DHT;

// Defenitions 
//------------------------------------------------------------------------
#define DHT11_PIN D3  // Define NodeMCU D3 pin to as temperature data pin of  DHT11
#define SCREEN_WIDTH 128 // OLED display width, in pixels
#define SCREEN_HEIGHT 32 // OLED display height, in pixels
#define BUZZER_PIN D7 // Defining Buzzer pin 
#define DHTTYPE DHT11 // Defining DHT type (22 or 11) (SECOND LIBRARY) ---> UNUSED
#define dht_dpin 0 // Defining DHT PIN (SECOND LIBRARY) ---> UNUSED

// Update these with values suitable for your network.
//------------------------------------------------------------------------
const char* ssid = "Arvin";
const char* password = "252525de";
const char* mqtt_server = "broker.mqtt-dashboard.com";
//------------------------------------------------------------------------
const int LED =  2;
char Start[1]={1};
int temp_max=50;
int hum_max=100;
int temp_min=0;
int hum_min=0;
//------------------------------------------------------------------------
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
WiFiClient espClient;
PubSubClient client(espClient);
long lastMsg = 0;
char msg[50];
//------------------------------------------------------------------------


// Function for converting string data to integer number
//------------------------------------------------------------------------
int convertToInt(char a[3],unsigned int len)
{
    int i=0;
    int num=0;
    for(int i=0; i<len;i++)
    {
      num=(a[i]-'0')+(num*10);
    }
    return num;;
}

// Setting up a WIFI connection
//------------------------------------------------------------------------
void setup_wifi() 
{
   delay(100);
  // We start by connecting to a WiFi network
    Serial.print("Connecting to ");
    Serial.println(ssid);
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) 
    {
      delay(500);
      Serial.print(".");
    }
  randomSeed(micros());
  Serial.println("");
  Serial.println("WiFi connected");
  Serial.println("IP address: ");
  Serial.println(WiFi.localIP());
}

// Subscribing to MQTT Server CallBack Function
//------------------------------------------------------------------------
void callback(char* topic, byte* payload, unsigned int length) 
{
  char temp_max_bin[3];
  char hum_max_bin[3];
  char temp_min_bin[3];
  char hum_min_bin[3];
  
  // Subscribing to golkhoone/temp||hum/max||min
  // Recieving data from MQTT server
  
  if (strcmp(topic,"golkhoone/temp/max") == 0)
  {
    for(int i=0;i<=(length-1);i++)
    {
      temp_max_bin[i]=(char)payload[i];
    }
    temp_max=convertToInt(temp_max_bin,length);
    //Serial.println(temp_max);
  }
  if(strcmp(topic,"golkhoone/hum/max") == 0)
  {
    for(int i=0;i<=(length-1);i++)
    {
      hum_max_bin[i]=(char)payload[i];
    }
    hum_max=convertToInt(hum_max_bin,length);
    //Serial.println(hum_max);
  }
  if(strcmp(topic,"golkhoone/temp/min") == 0)
  {
    for(int i=0;i<=(length-1);i++)
    {
      temp_min_bin[i]=(char)payload[i];
    }
    temp_min=convertToInt(temp_min_bin,length);
    //Serial.println(temp_min);
  }
  if(strcmp(topic,"golkhoone/hum/min") == 0)
  {
    for(int i=0;i<=(length-1);i++)
    {
      hum_min_bin[i]=(char)payload[i];
    }
   hum_min=convertToInt(hum_min_bin,length);
   //Serial.println(hum_min);
  }
  Serial.println();
} //end callback

// Reconnecting Function
//------------------------------------------------------------------------
void reconnect() 
{
  // Loop until we're reconnected
  while (!client.connected()) 
  {
    Serial.print("Attempting MQTT connection...");
    // Create a random client ID
    String clientId = "ESP8266Client-";
    clientId += String(random(0xffff), HEX);
    // Attempt to connect
    //if you MQTT broker has clientID,username and password
    if (client.connect(clientId.c_str()))
    {
      Serial.println("connected");
     //once connected to MQTT broker, subscribe command if any
      client.publish("golkhoone/alive",Start);
      client.subscribe("golkhoone/temp/max",1);
      client.subscribe("golkhoone/hum/max",1);
      client.subscribe("golkhoone/temp/min",1);
      client.subscribe("golkhoone/hum/min",1);;
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      // Wait 6 seconds before retrying
      delay(6000);
    }
  }
} //end reconnect()


void setup() 
{
  // Setup OLED LCD
//------------------------------------------------------------------------
  Serial.begin(9600);
  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) 
  { // Address 0x3D for 128x64
    Serial.println(F("SSD1306 allocation failed"));
    for(;;);
  }
  delay(500);
  display.clearDisplay();
  display.setTextSize(1.75);
  display.setTextColor(WHITE);

  // Setting up GPIO Output pins
//------------------------------------------------------------------------
  pinMode(LED,OUTPUT);
  pinMode(BUZZER_PIN,OUTPUT);

  // Setting up WIFI and server connection
  // Subscribing to MQTT server
//------------------------------------------------------------------------
  setup_wifi();
  client.setServer(mqtt_server, 1883);
  client.setCallback(callback);
  client.subscribe("golkhoone/temp/max",1);
  client.subscribe("golkhoone/hum/max",1);
  client.subscribe("golkhoone/temp/min",1);
  client.subscribe("golkhoone/hum/min",1);
  client.publish("golkhoone/alive",Start);
  int chk = DHT.read11(DHT11_PIN);
  Serial.print("Starting Humidity: " );
  Serial.print(DHT.humidity, 1);
  Serial.println('%');
  Serial.print("Starting Temparature ");
  Serial.print(DHT.temperature, 1);
  Serial.println('C');
}

void loop() 
{
    //  Sensor and Buzzer Configuration 
//------------------------------------------------------------------------
    if (DHT.humidity >= hum_max || DHT.humidity <= hum_min)
    {
      digitalWrite(BUZZER_PIN,HIGH);
      delay(200);
      digitalWrite(BUZZER_PIN,LOW);
      delay(100);
      digitalWrite(LED,HIGH);
      delay(100);
      digitalWrite(LED,LOW);
      delay(100);
    }
    else
    {
      digitalWrite(LED,LOW);
      digitalWrite(BUZZER_PIN,LOW);
    }
    delay(100);
//------------------------------------------------------------------------
    if (DHT.temperature >= temp_max || DHT.temperature <= temp_min)
    {
      digitalWrite(BUZZER_PIN,HIGH);
      delay(200);
      digitalWrite(BUZZER_PIN,LOW);
      delay(100);
      digitalWrite(LED,HIGH);
      delay(100);
      digitalWrite(LED,LOW);
      delay(100);
    }
    else
    {
      digitalWrite(LED,LOW);
      digitalWrite(BUZZER_PIN,LOW);
    }
    delay(100);
    
  // Publishing data from NodeMCU to MQTT server
//------------------------------------------------------------------------
  if (!client.connected()) 
  {
    reconnect();
  }
  client.loop();
  long now = millis();
  // read DHT11 sensor every second
  if (now - lastMsg > 1000) 
  {
     lastMsg = now;
     int chk = DHT.read11(DHT11_PIN);
     String msg=" Temperature: ";
     msg= msg+ DHT.temperature;
     msg = msg+" C   Humidity: " ;
     msg=msg+DHT.humidity ;
     msg=msg+"%";
     char message[58];
     msg.toCharArray(message,58);
     
    // Printing real-time data in serial monitor
//------------------------------------------------------------------------
     Serial.println(message);

    // Only for test ---> Recieving data from each subscribed topic
    /*
     Serial.print(temp_max_bin);
     Serial.print(hum_max_bin);
     Serial.print(temp_min_bin);
     Serial.print(hum_min_bin); 
     */

    // Preparing data to publish
//------------------------------------------------------------------------
     char Temp[58];
     char Hum[58];
     String temp="";
     String hum="";
     temp=temp + DHT.temperature ;
     hum=hum + DHT.humidity ;
     temp.toCharArray(Temp,58);
     hum.toCharArray(Hum,58);
     
    // Publish sensor data to MQTT broker
//------------------------------------------------------------------------     
     client.publish("DHT11_IoT", message);
     client.publish("golkhoone/temp/live",Temp);
     client.publish("golkhoone/hum/live",Hum);
    
    // OLED LCD Monitoring temperature and humidity
//------------------------------------------------------------------------
    display.setCursor(0, 10);
    display.println("Temp:");
    display.display();
    pinMode(BUILTIN_LED, OUTPUT);
    display.setCursor(64, 10);
    display.println("Humidty:");
    display.display();
    pinMode(BUILTIN_LED, OUTPUT); 
    display.setCursor(0, 25);
    display.println(DHT.temperature);
    display.setCursor(35, 25);
    display.println("C");
    display.display();
    pinMode(BUILTIN_LED, OUTPUT);
    display.setCursor(64, 25);
    display.println(DHT.humidity);
    display.setCursor(100, 25);
    display.println("%");
    display.display();
    pinMode(BUILTIN_LED, OUTPUT);
    delay(100);
    display.clearDisplay();
  }
}
