#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(MirrorAvatarModule, RCTEventEmitter)

RCT_EXTERN_METHOD(playAudio:(NSString *)base64)
RCT_EXTERN_METHOD(stopAudio)
RCT_EXTERN_METHOD(startListening:(NSString *)base64 silenceMs:(nonnull NSNumber *)silenceMs)
RCT_EXTERN_METHOD(stopListening)
RCT_EXTERN_METHOD(startLiveCapture)
RCT_EXTERN_METHOD(stopLiveCapture)
RCT_EXTERN_METHOD(enqueueAudioChunk:(NSString *)base64 seq:(nonnull NSNumber *)seq)
RCT_EXTERN_METHOD(stopPlayback)

@end
