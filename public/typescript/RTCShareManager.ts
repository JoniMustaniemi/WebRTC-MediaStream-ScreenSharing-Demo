class ConnectionManager {
  private options: any;

  public liveModeStatus_client_1: boolean;
  public RTCPeerConnection_client_1: any;
  public RTCPeerConnectionObject_client_1: RTCPeerConnection;
  private offer_client_1: RTCSessionDescriptionInit;
  public liveModeStatus_client_2: boolean;
  public RTCPeerConnection_client_2: any;
  public datachannel: RTCDataChannel;
  public RTCPeerConnectionObject_client_2: RTCPeerConnection;
  private answer_client_2: RTCSessionDescriptionInit;
  public stopLiveMode: Function;
  public onReceiveScreen: Function;

  constructor(options: any) {
    this.options = options;
  }

  public startConnection(liveModeStatus: boolean, client: string) {
    if (client == "1") {
      this.liveModeStatus_client_1 = liveModeStatus;
      if (!this.RTCPeerConnection_client_1) {
        this.RTCPeerConnection_client_1 = new Connection("1", this.options);
        this.RTCPeerConnectionObject_client_1 = this.RTCPeerConnection_client_1.client.object;
        this.datachannel = this.RTCPeerConnectionObject_client_1.createDataChannel("channel1");
        this.setEventHandlers("1");
      }
    } else if (client == "2") {
      this.liveModeStatus_client_2 = liveModeStatus;
      if (!this.RTCPeerConnection_client_2) {
        this.RTCPeerConnection_client_2 = new Connection("2", this.options);
        this.RTCPeerConnectionObject_client_2 = this.RTCPeerConnection_client_2.client.object;
        this.setEventHandlers("2");
      }
    }
    return;
  }

  private setEventHandlers(client) {
    if (client == "1") {
      this.RTCPeerConnectionObject_client_1.onicecandidate = (event) => {
        if (event.candidate) {
          try {
            this.RTCPeerConnectionObject_client_2.addIceCandidate(event.candidate);
          } catch (error) {
            console.log(error);
            return;
          }
        } else {
          console.log("all candidates sent by client 1");
          if (this.RTCPeerConnectionObject_client_1.iceConnectionState === "new" && this.RTCPeerConnectionObject_client_2.iceConnectionState === "new") {
            this.stopLiveMode({
              restart: true
            });
          }
        }
      };

      this.RTCPeerConnectionObject_client_1.onnegotiationneeded = () => {
        if (this.liveModeStatus_client_1 && this.liveModeStatus_client_2) {
          this.createOffer(this.RTCPeerConnectionObject_client_1, "1");
        }
      }

      this.RTCPeerConnectionObject_client_1.addEventListener("iceconnectionstatechange", ev => {
        if (this.RTCPeerConnectionObject_client_1) {
          if (this.RTCPeerConnectionObject_client_1.iceConnectionState === "disconnected") {
            this.RTCPeerConnectionObject_client_1.close();
            this.RTCPeerConnectionObject_client_1 = null;
          }
          if (this.RTCPeerConnectionObject_client_1.iceConnectionState === "connected") {
            console.log("client 1 connected")
          }
          if (this.RTCPeerConnectionObject_client_1.iceConnectionState === "closed") {
            return;
          }
        }
      }, false);
      this.datachannel.onopen = (event) => {

        this.handleDataChannelOpen(event, "1");
      }

      this.datachannel.onerror = this.handleDataChannelError;

      this.datachannel.onclose = (event) => {
        this.handleDataChannelClose();
      }
    } else if (client == "2") {
      this.RTCPeerConnectionObject_client_2.addEventListener("iceconnectionstatechange", ev => {
        if (this.RTCPeerConnectionObject_client_2) {
          if (this.RTCPeerConnectionObject_client_2.iceConnectionState === "disconnected" || this.RTCPeerConnectionObject_client_2.iceConnectionState === "closed") {
            this.RTCPeerConnectionObject_client_2.close();

          }
          if (this.RTCPeerConnectionObject_client_2.iceConnectionState === "connected") {
            console.log("client 2 connected");
          }
        }
      }, false);

      this.RTCPeerConnectionObject_client_2.onicecandidate = (event) => {
        if (event.candidate) {
          try {
            this.RTCPeerConnectionObject_client_1.addIceCandidate(event.candidate);
          } catch (error) {
            console.log(error);
          }
        } else {
          console.log("all candidates sent by client 2");
        }
      };

      this.RTCPeerConnectionObject_client_2.ontrack = (event) => {
        if (typeof this.options.event_handlers.on_screen_receive === 'function') {
          this.options.event_handlers.on_screen_receive({});
        }
        this.onReceiveScreen({
          event: event
        });
      }
    }
  }

  private handleDataChannelOpen(event, client) {
    if (client == "1") {
      console.log("Datachannel is open");
    }
    if (this.datachannel) {
      if (this.datachannel.readyState == "open") {
        if (typeof this.options.event_handlers.on_established_connection === 'function') {
          this.options.event_handlers.on_established_connection({});
        }
      }
    } else {
      return;
    }
  }

  private handleDataChannelError(error) {
    console.log(error);
  }

  private handleDataChannelClose() {
    console.log("datachannel closed");
    if (typeof this.options.event_handlers.on_datachannel_close === 'function') {
      this.options.event_handlers.on_datachannel_close({});
    }
  }

  public closeConnection(client: string) {
    if (client == "1") {
      this.RTCPeerConnectionObject_client_1.close();
      this.RTCPeerConnection_client_1 = null;
    } else if (client == "2") {
      this.RTCPeerConnectionObject_client_2.close();
      this.RTCPeerConnection_client_2 = null;
    }
    this.checkLivemodeStatuses(this.liveModeStatus_client_1, this.liveModeStatus_client_2);
  }

  private checkLivemodeStatuses(status_client_1, status_client_2) {
    if (status_client_1 == false || status_client_2 == false) {
      if (typeof this.options.event_handlers.no_live_mode === 'function') {
        this.options.event_handlers.no_live_mode({});
      }
    }
  }

  //sets local description, creates offer and sends it to correct client
  private async createOffer(RTC_object: RTCPeerConnection, client: string) {
    try {
      if (client == "1") {
        this.offer_client_1 = await RTC_object.createOffer();
        var debugOffer = this.offer_client_1;

        await RTC_object.setLocalDescription(this.offer_client_1);
        if (RTC_object.signalingState == "have-local-offer") {
          this.setRemote(this.offer_client_1, "offer", this.RTCPeerConnectionObject_client_2);
        }
      }
    } catch (error) {
      console.log(error);
    }
  }

  //sets remote description based on type (offer or answer)
  //if type is 'answer' completes the handshake and checks if RTCPeerConnection object is connected succesfully
  private async setRemote(sessionDesc: RTCSessionDescriptionInit, type: string, RTC_object: RTCPeerConnection) {
    if (type == "offer") {
      try {
        await RTC_object.setRemoteDescription(sessionDesc);
        this.answer_client_2 = await RTC_object.createAnswer();
        await RTC_object.setLocalDescription(this.answer_client_2);
        if (RTC_object.signalingState == "stable") {
          this.setRemote(this.answer_client_2, "answer", this.RTCPeerConnectionObject_client_1);
        }
      } catch (error) {
        console.log(error);
      }
    } else if (type == "answer") {
      try {
        await RTC_object.setRemoteDescription(sessionDesc);
      } catch (error) {
        console.log(error);
      }
    }
  }
}

interface IClient {
  id: string;
  object: RTCPeerConnection;
}

class Connection {
  public client: IClient;

  constructor(client: string, options: any) {
    this.client = {
      id: client,
      object: new RTCPeerConnection()
    };
  }
}

class RTCShareManager {
  private liveModeStatus_client_1: boolean = false;
  private liveModeStatus_client_2: boolean = false;
  private screenStatus: boolean = false;
  private conMan: ConnectionManager;
  private screenSharing: ScreenSharing;
  private options: any;

  constructor(options: any) {
    this.options = options;
    this.conMan = new ConnectionManager(
      options
    );

    this.conMan.stopLiveMode = (args: any) => {
      this.stopLiveMode(null, args.restart);
    }

    this.conMan.onReceiveScreen = (args: any) => {
      this.screenSharing.receiveMedia(args.event);
    }
  }

  public toggleScreenSharing() {
    if (typeof this.options.event_handlers.on_screen_mode === 'function') {
      this.options.event_handlers.on_screen_mode({
        screenMode: !this.screenStatus
      });
    }

    if (!this.screenStatus) {
      this.screenStatus = true;
      console.log("Screen sharing is on");
      this.screenSharing = new ScreenSharing(this.conMan.RTCPeerConnectionObject_client_1, this.conMan.RTCPeerConnectionObject_client_2, this.options);
    } else {
      this.screenStatus = false;
      console.log("Screen sharing is off");
      this.screenSharing.stopMediaSharing();
    }
  }

  public liveMode() {
    if (typeof this.options.event_handlers.on_live_mode === 'function') {
      this.options.event_handlers.on_live_mode({
        isLive: !this.liveModeStatus_client_1
      });
    }

    if (!this.liveModeStatus_client_1) {
      this.liveModeStatus_client_1 = true;
      this.liveModeStatus_client_2 = true;
      this.conMan.startConnection(this.liveModeStatus_client_1, "1");
      this.conMan.startConnection(this.liveModeStatus_client_2, "2");
    } else {
      if(this.screenStatus) {
        this.toggleScreenSharing();
      }
      this.stopLiveMode("1");
      this.stopLiveMode("2");
    }
  }


  private stopLiveMode(client ? : string, restart ? : boolean) {
    if (client == "1") {
      this.screenSharing.stopMediaSharing();
      this.liveModeStatus_client_1 = false;
      this.conMan.liveModeStatus_client_1 = false;
      if (this.conMan.RTCPeerConnection_client_1) {
        this.conMan.closeConnection("1");
        this.conMan.RTCPeerConnection_client_1 = undefined;
      }
      return;
    } else if (client == "2") {
      this.liveModeStatus_client_2 = false;
      this.conMan.liveModeStatus_client_2 = false;
      if (this.conMan.RTCPeerConnection_client_2) {
        this.conMan.closeConnection("2");
        this.conMan.RTCPeerConnection_client_2 = undefined;
      }
      return;
    } else if (restart !== undefined) {
      this.liveModeStatus_client_1 = false;
      this.liveModeStatus_client_2 = false;
      this.conMan.RTCPeerConnection_client_1 = null;
      this.conMan.RTCPeerConnection_client_2 = null;
      this.conMan.RTCPeerConnectionObject_client_1 = null;
      this.conMan.RTCPeerConnectionObject_client_2 = null;
      this.conMan.datachannel = null;
      this.liveModeStatus_client_1 = true;
      this.liveModeStatus_client_2 = true;
      this.conMan.startConnection(this.liveModeStatus_client_1, "1");
      this.conMan.startConnection(this.liveModeStatus_client_2, "2");
    }
  }
}

class ScreenSharing {
  private options: any;
  private captureStream: MediaStream;
  private videoTracks: MediaStreamTrack[];
  private RTC_object_1: RTCPeerConnection;
  private RTC_object_2: RTCPeerConnection;
  private screenContainer: HTMLElement;
  private screenConstraints = {
    audio: false,
    video: {
      cursor: "always",
    }
  };

  constructor(client1: RTCPeerConnection, client2: RTCPeerConnection, options ? : any) {
    this.options = options;
    this.RTC_object_1 = client1;
    this.RTC_object_2 = client2;
    this.screenContainer = document.getElementById("screenContainer");
    this.getMedia();
  }

  private async getMedia() {
    (<any>navigator.mediaDevices).getDisplayMedia(this.screenConstraints).then((stream: MediaStream) => {
        console.log("Sharing Screen");
        this.captureStream = stream;
        this.videoTracks = this.captureStream.getTracks();
        this.attachTrackToConnection();
      });
  }

  private attachTrackToConnection() {
    for (const track of this.videoTracks) {
      this.RTC_object_1.addTrack(track);
    }
  }

  public stopMediaSharing() {
    let tracks = this.captureStream.getVideoTracks();
    tracks.forEach(track => {
      track.stop();
    });
    this.screenContainer.innerHTML = "";
  }

  public receiveMedia(event: MediaStreamTrackEvent) {
    let inboundStream = null;
    let screenPlayer: HTMLVideoElement = < HTMLVideoElement > document.createElement("VIDEO");
    screenPlayer.setAttribute("autoplay", "");
    screenPlayer.classList.add("screenPlayer");
    this.screenContainer.appendChild(screenPlayer);
    if (!inboundStream) {
      inboundStream = new MediaStream();
      screenPlayer.srcObject = inboundStream;
    }
    inboundStream.addTrack(event.track);
  }
}
