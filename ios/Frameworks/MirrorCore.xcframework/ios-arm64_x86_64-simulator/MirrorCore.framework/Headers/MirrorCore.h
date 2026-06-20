#import <Foundation/NSArray.h>
#import <Foundation/NSDictionary.h>
#import <Foundation/NSError.h>
#import <Foundation/NSObject.h>
#import <Foundation/NSSet.h>
#import <Foundation/NSString.h>
#import <Foundation/NSValue.h>

@class MirrorCoreBlendshapePose, MirrorCoreBlendshapePoseCompanion, MirrorCoreHeadGazeFrame, MirrorCoreHeadGazePose, MirrorCoreHeadGazePoseCompanion, MirrorCoreKotlinArray<T>, MirrorCoreKotlinEnum<E>, MirrorCoreKotlinEnumCompanion, MirrorCoreMirrorAudioFormat, MirrorCoreMirrorAudioFormatCompanion, MirrorCoreMirrorAvatarError, MirrorCoreMirrorAvatarErrorCode, MirrorCoreMirrorAvatarErrorCodeCompanion, MirrorCoreMirrorAvatarState, MirrorCoreMirrorAvatarStateCompanion, MirrorCoreMirrorBlendshapeFrame, MirrorCoreMirrorBlendshapeName, MirrorCoreMirrorBlendshapeNameCompanion, MirrorCoreMirrorLatencyMetrics, MirrorCoreMirrorProtocolIssue, MirrorCoreMirrorProtocolValidator, MirrorCoreMirrorSessionConfig, MirrorCoreMirrorStateTransition;

@protocol MirrorCoreKotlinComparable, MirrorCoreKotlinIterator;

NS_ASSUME_NONNULL_BEGIN
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wunknown-warning-option"
#pragma clang diagnostic ignored "-Wincompatible-property-type"
#pragma clang diagnostic ignored "-Wnullability"

#pragma push_macro("_Nullable_result")
#if !__has_feature(nullability_nullable_result)
#undef _Nullable_result
#define _Nullable_result _Nullable
#endif

__attribute__((swift_name("KotlinBase")))
@interface MirrorCoreBase : NSObject
- (instancetype)init __attribute__((unavailable));
+ (instancetype)new __attribute__((unavailable));
+ (void)initialize __attribute__((objc_requires_super));
@end

@interface MirrorCoreBase (MirrorCoreBaseCopying) <NSCopying>
@end

__attribute__((swift_name("KotlinMutableSet")))
@interface MirrorCoreMutableSet<ObjectType> : NSMutableSet<ObjectType>
@end

__attribute__((swift_name("KotlinMutableDictionary")))
@interface MirrorCoreMutableDictionary<KeyType, ObjectType> : NSMutableDictionary<KeyType, ObjectType>
@end

@interface NSError (NSErrorMirrorCoreKotlinException)
@property (readonly) id _Nullable kotlinException;
@end

__attribute__((swift_name("KotlinNumber")))
@interface MirrorCoreNumber : NSNumber
- (instancetype)initWithChar:(char)value __attribute__((unavailable));
- (instancetype)initWithUnsignedChar:(unsigned char)value __attribute__((unavailable));
- (instancetype)initWithShort:(short)value __attribute__((unavailable));
- (instancetype)initWithUnsignedShort:(unsigned short)value __attribute__((unavailable));
- (instancetype)initWithInt:(int)value __attribute__((unavailable));
- (instancetype)initWithUnsignedInt:(unsigned int)value __attribute__((unavailable));
- (instancetype)initWithLong:(long)value __attribute__((unavailable));
- (instancetype)initWithUnsignedLong:(unsigned long)value __attribute__((unavailable));
- (instancetype)initWithLongLong:(long long)value __attribute__((unavailable));
- (instancetype)initWithUnsignedLongLong:(unsigned long long)value __attribute__((unavailable));
- (instancetype)initWithFloat:(float)value __attribute__((unavailable));
- (instancetype)initWithDouble:(double)value __attribute__((unavailable));
- (instancetype)initWithBool:(BOOL)value __attribute__((unavailable));
- (instancetype)initWithInteger:(NSInteger)value __attribute__((unavailable));
- (instancetype)initWithUnsignedInteger:(NSUInteger)value __attribute__((unavailable));
+ (instancetype)numberWithChar:(char)value __attribute__((unavailable));
+ (instancetype)numberWithUnsignedChar:(unsigned char)value __attribute__((unavailable));
+ (instancetype)numberWithShort:(short)value __attribute__((unavailable));
+ (instancetype)numberWithUnsignedShort:(unsigned short)value __attribute__((unavailable));
+ (instancetype)numberWithInt:(int)value __attribute__((unavailable));
+ (instancetype)numberWithUnsignedInt:(unsigned int)value __attribute__((unavailable));
+ (instancetype)numberWithLong:(long)value __attribute__((unavailable));
+ (instancetype)numberWithUnsignedLong:(unsigned long)value __attribute__((unavailable));
+ (instancetype)numberWithLongLong:(long long)value __attribute__((unavailable));
+ (instancetype)numberWithUnsignedLongLong:(unsigned long long)value __attribute__((unavailable));
+ (instancetype)numberWithFloat:(float)value __attribute__((unavailable));
+ (instancetype)numberWithDouble:(double)value __attribute__((unavailable));
+ (instancetype)numberWithBool:(BOOL)value __attribute__((unavailable));
+ (instancetype)numberWithInteger:(NSInteger)value __attribute__((unavailable));
+ (instancetype)numberWithUnsignedInteger:(NSUInteger)value __attribute__((unavailable));
@end

__attribute__((swift_name("KotlinByte")))
@interface MirrorCoreByte : MirrorCoreNumber
- (instancetype)initWithChar:(char)value;
+ (instancetype)numberWithChar:(char)value;
@end

__attribute__((swift_name("KotlinUByte")))
@interface MirrorCoreUByte : MirrorCoreNumber
- (instancetype)initWithUnsignedChar:(unsigned char)value;
+ (instancetype)numberWithUnsignedChar:(unsigned char)value;
@end

__attribute__((swift_name("KotlinShort")))
@interface MirrorCoreShort : MirrorCoreNumber
- (instancetype)initWithShort:(short)value;
+ (instancetype)numberWithShort:(short)value;
@end

__attribute__((swift_name("KotlinUShort")))
@interface MirrorCoreUShort : MirrorCoreNumber
- (instancetype)initWithUnsignedShort:(unsigned short)value;
+ (instancetype)numberWithUnsignedShort:(unsigned short)value;
@end

__attribute__((swift_name("KotlinInt")))
@interface MirrorCoreInt : MirrorCoreNumber
- (instancetype)initWithInt:(int)value;
+ (instancetype)numberWithInt:(int)value;
@end

__attribute__((swift_name("KotlinUInt")))
@interface MirrorCoreUInt : MirrorCoreNumber
- (instancetype)initWithUnsignedInt:(unsigned int)value;
+ (instancetype)numberWithUnsignedInt:(unsigned int)value;
@end

__attribute__((swift_name("KotlinLong")))
@interface MirrorCoreLong : MirrorCoreNumber
- (instancetype)initWithLongLong:(long long)value;
+ (instancetype)numberWithLongLong:(long long)value;
@end

__attribute__((swift_name("KotlinULong")))
@interface MirrorCoreULong : MirrorCoreNumber
- (instancetype)initWithUnsignedLongLong:(unsigned long long)value;
+ (instancetype)numberWithUnsignedLongLong:(unsigned long long)value;
@end

__attribute__((swift_name("KotlinFloat")))
@interface MirrorCoreFloat : MirrorCoreNumber
- (instancetype)initWithFloat:(float)value;
+ (instancetype)numberWithFloat:(float)value;
@end

__attribute__((swift_name("KotlinDouble")))
@interface MirrorCoreDouble : MirrorCoreNumber
- (instancetype)initWithDouble:(double)value;
+ (instancetype)numberWithDouble:(double)value;
@end

__attribute__((swift_name("KotlinBoolean")))
@interface MirrorCoreBoolean : MirrorCoreNumber
- (instancetype)initWithBool:(BOOL)value;
+ (instancetype)numberWithBool:(BOOL)value;
@end

__attribute__((objc_subclassing_restricted))
__attribute__((swift_name("BlendshapePose")))
@interface MirrorCoreBlendshapePose : MirrorCoreBase
- (instancetype)initWithValues:(NSDictionary<MirrorCoreMirrorBlendshapeName *, MirrorCoreDouble *> *)values __attribute__((swift_name("init(values:)"))) __attribute__((objc_designated_initializer));
@property (class, readonly, getter=companion) MirrorCoreBlendshapePoseCompanion *companion __attribute__((swift_name("companion")));
- (MirrorCoreBlendshapePose *)doCopyValues:(NSDictionary<MirrorCoreMirrorBlendshapeName *, MirrorCoreDouble *> *)values __attribute__((swift_name("doCopy(values:)")));
- (BOOL)isEqual:(id _Nullable)other __attribute__((swift_name("isEqual(_:)")));
- (double)getName:(MirrorCoreMirrorBlendshapeName *)name __attribute__((swift_name("get(name:)")));
- (NSUInteger)hash __attribute__((swift_name("hash()")));
- (MirrorCoreBlendshapePose *)normalized __attribute__((swift_name("normalized()")));
- (NSString *)description __attribute__((swift_name("description()")));
@property (readonly) NSDictionary<MirrorCoreMirrorBlendshapeName *, MirrorCoreDouble *> *values __attribute__((swift_name("values")));
@end

__attribute__((objc_subclassing_restricted))
__attribute__((swift_name("BlendshapePose.Companion")))
@interface MirrorCoreBlendshapePoseCompanion : MirrorCoreBase
+ (instancetype)alloc __attribute__((unavailable));
+ (instancetype)allocWithZone:(struct _NSZone *)zone __attribute__((unavailable));
+ (instancetype)companion __attribute__((swift_name("init()")));
@property (class, readonly, getter=shared) MirrorCoreBlendshapePoseCompanion *shared __attribute__((swift_name("shared")));
@property (readonly) MirrorCoreBlendshapePose *Empty __attribute__((swift_name("Empty")));
@end

__attribute__((objc_subclassing_restricted))
__attribute__((swift_name("BlendshapeSmoother")))
@interface MirrorCoreBlendshapeSmoother : MirrorCoreBase
- (instancetype)initWithAlpha:(double)alpha __attribute__((swift_name("init(alpha:)"))) __attribute__((objc_designated_initializer));
- (void)reset __attribute__((swift_name("reset()")));
- (MirrorCoreBlendshapePose *)smoothNextPose:(MirrorCoreBlendshapePose *)nextPose __attribute__((swift_name("smooth(nextPose:)")));
@end

__attribute__((objc_subclassing_restricted))
__attribute__((swift_name("BlendshapeTimeline")))
@interface MirrorCoreBlendshapeTimeline : MirrorCoreBase
- (instancetype)init __attribute__((swift_name("init()"))) __attribute__((objc_designated_initializer));
+ (instancetype)new __attribute__((availability(swift, unavailable, message="use object initializers instead")));
- (void)addFrameFrame:(MirrorCoreMirrorBlendshapeFrame *)frame __attribute__((swift_name("addFrame(frame:)")));
- (void)clear __attribute__((swift_name("clear()")));
- (void)clearResponseResponseId:(NSString *)responseId __attribute__((swift_name("clearResponse(responseId:)")));
- (MirrorCoreBlendshapePose *)poseAtResponseId:(NSString *)responseId audioTimeMs:(int64_t)audioTimeMs __attribute__((swift_name("poseAt(responseId:audioTimeMs:)")));
@end

__attribute__((objc_subclassing_restricted))
__attribute__((swift_name("HeadGazeFrame")))
@interface MirrorCoreHeadGazeFrame : MirrorCoreBase
- (instancetype)initWithResponseId:(NSString *)responseId sequence:(int64_t)sequence audioTimeMs:(int64_t)audioTimeMs pose:(MirrorCoreHeadGazePose *)pose __attribute__((swift_name("init(responseId:sequence:audioTimeMs:pose:)"))) __attribute__((objc_designated_initializer));
- (MirrorCoreHeadGazeFrame *)doCopyResponseId:(NSString *)responseId sequence:(int64_t)sequence audioTimeMs:(int64_t)audioTimeMs pose:(MirrorCoreHeadGazePose *)pose __attribute__((swift_name("doCopy(responseId:sequence:audioTimeMs:pose:)")));
- (BOOL)isEqual:(id _Nullable)other __attribute__((swift_name("isEqual(_:)")));
- (NSUInteger)hash __attribute__((swift_name("hash()")));
- (NSString *)description __attribute__((swift_name("description()")));
@property (readonly) int64_t audioTimeMs __attribute__((swift_name("audioTimeMs")));
@property (readonly) MirrorCoreHeadGazePose *pose __attribute__((swift_name("pose")));
@property (readonly) NSString *responseId __attribute__((swift_name("responseId")));
@property (readonly) int64_t sequence __attribute__((swift_name("sequence")));
@end

__attribute__((objc_subclassing_restricted))
__attribute__((swift_name("HeadGazePose")))
@interface MirrorCoreHeadGazePose : MirrorCoreBase
- (instancetype)initWithHeadYaw:(double)headYaw headPitch:(double)headPitch headRoll:(double)headRoll leftEyeYaw:(double)leftEyeYaw leftEyePitch:(double)leftEyePitch leftEyeRoll:(double)leftEyeRoll rightEyeYaw:(double)rightEyeYaw rightEyePitch:(double)rightEyePitch __attribute__((swift_name("init(headYaw:headPitch:headRoll:leftEyeYaw:leftEyePitch:leftEyeRoll:rightEyeYaw:rightEyePitch:)"))) __attribute__((objc_designated_initializer));
@property (class, readonly, getter=companion) MirrorCoreHeadGazePoseCompanion *companion __attribute__((swift_name("companion")));
- (MirrorCoreHeadGazePose *)doCopyHeadYaw:(double)headYaw headPitch:(double)headPitch headRoll:(double)headRoll leftEyeYaw:(double)leftEyeYaw leftEyePitch:(double)leftEyePitch leftEyeRoll:(double)leftEyeRoll rightEyeYaw:(double)rightEyeYaw rightEyePitch:(double)rightEyePitch __attribute__((swift_name("doCopy(headYaw:headPitch:headRoll:leftEyeYaw:leftEyePitch:leftEyeRoll:rightEyeYaw:rightEyePitch:)")));
- (BOOL)isEqual:(id _Nullable)other __attribute__((swift_name("isEqual(_:)")));
- (NSUInteger)hash __attribute__((swift_name("hash()")));
- (MirrorCoreHeadGazePose *)sanitized __attribute__((swift_name("sanitized()")));
- (NSString *)description __attribute__((swift_name("description()")));
@property (readonly) double headPitch __attribute__((swift_name("headPitch")));
@property (readonly) double headRoll __attribute__((swift_name("headRoll")));
@property (readonly) double headYaw __attribute__((swift_name("headYaw")));
@property (readonly) double leftEyePitch __attribute__((swift_name("leftEyePitch")));
@property (readonly) double leftEyeRoll __attribute__((swift_name("leftEyeRoll")));
@property (readonly) double leftEyeYaw __attribute__((swift_name("leftEyeYaw")));
@property (readonly) double rightEyePitch __attribute__((swift_name("rightEyePitch")));
@property (readonly) double rightEyeYaw __attribute__((swift_name("rightEyeYaw")));
@end

__attribute__((objc_subclassing_restricted))
__attribute__((swift_name("HeadGazePose.Companion")))
@interface MirrorCoreHeadGazePoseCompanion : MirrorCoreBase
+ (instancetype)alloc __attribute__((unavailable));
+ (instancetype)allocWithZone:(struct _NSZone *)zone __attribute__((unavailable));
+ (instancetype)companion __attribute__((swift_name("init()")));
@property (class, readonly, getter=shared) MirrorCoreHeadGazePoseCompanion *shared __attribute__((swift_name("shared")));
@property (readonly) MirrorCoreHeadGazePose *Empty __attribute__((swift_name("Empty")));
@end

__attribute__((objc_subclassing_restricted))
__attribute__((swift_name("HeadGazeSmoother")))
@interface MirrorCoreHeadGazeSmoother : MirrorCoreBase
- (instancetype)initWithAlpha:(double)alpha __attribute__((swift_name("init(alpha:)"))) __attribute__((objc_designated_initializer));
- (void)reset __attribute__((swift_name("reset()")));
- (MirrorCoreHeadGazePose *)smoothNextPose:(MirrorCoreHeadGazePose *)nextPose __attribute__((swift_name("smooth(nextPose:)")));
@end

__attribute__((objc_subclassing_restricted))
__attribute__((swift_name("HeadGazeTimeline")))
@interface MirrorCoreHeadGazeTimeline : MirrorCoreBase
- (instancetype)init __attribute__((swift_name("init()"))) __attribute__((objc_designated_initializer));
+ (instancetype)new __attribute__((availability(swift, unavailable, message="use object initializers instead")));
- (void)addFrameFrame:(MirrorCoreHeadGazeFrame *)frame __attribute__((swift_name("addFrame(frame:)")));
- (void)clear __attribute__((swift_name("clear()")));
- (void)clearResponseResponseId:(NSString *)responseId __attribute__((swift_name("clearResponse(responseId:)")));
- (MirrorCoreHeadGazePose *)poseAtResponseId:(NSString *)responseId audioTimeMs:(int64_t)audioTimeMs __attribute__((swift_name("poseAt(responseId:audioTimeMs:)")));
@end

__attribute__((swift_name("KotlinComparable")))
@protocol MirrorCoreKotlinComparable
@required
- (int32_t)compareToOther:(id _Nullable)other __attribute__((swift_name("compareTo(other:)")));
@end

__attribute__((swift_name("KotlinEnum")))
@interface MirrorCoreKotlinEnum<E> : MirrorCoreBase <MirrorCoreKotlinComparable>
- (instancetype)initWithName:(NSString *)name ordinal:(int32_t)ordinal __attribute__((swift_name("init(name:ordinal:)"))) __attribute__((objc_designated_initializer));
@property (class, readonly, getter=companion) MirrorCoreKotlinEnumCompanion *companion __attribute__((swift_name("companion")));
- (int32_t)compareToOther:(E)other __attribute__((swift_name("compareTo(other:)")));
- (BOOL)isEqual:(id _Nullable)other __attribute__((swift_name("isEqual(_:)")));
- (NSUInteger)hash __attribute__((swift_name("hash()")));
- (NSString *)description __attribute__((swift_name("description()")));
@property (readonly) NSString *name __attribute__((swift_name("name")));
@property (readonly) int32_t ordinal __attribute__((swift_name("ordinal")));
@end

__attribute__((objc_subclassing_restricted))
__attribute__((swift_name("MirrorAudioFormat")))
@interface MirrorCoreMirrorAudioFormat : MirrorCoreKotlinEnum<MirrorCoreMirrorAudioFormat *>
+ (instancetype)alloc __attribute__((unavailable));
+ (instancetype)allocWithZone:(struct _NSZone *)zone __attribute__((unavailable));
- (instancetype)initWithName:(NSString *)name ordinal:(int32_t)ordinal __attribute__((swift_name("init(name:ordinal:)"))) __attribute__((objc_designated_initializer)) __attribute__((unavailable));
@property (class, readonly, getter=companion) MirrorCoreMirrorAudioFormatCompanion *companion __attribute__((swift_name("companion")));
@property (class, readonly) MirrorCoreMirrorAudioFormat *pcm16 __attribute__((swift_name("pcm16")));
@property (class, readonly) MirrorCoreMirrorAudioFormat *aac __attribute__((swift_name("aac")));
@property (class, readonly) MirrorCoreMirrorAudioFormat *opus __attribute__((swift_name("opus")));
+ (MirrorCoreKotlinArray<MirrorCoreMirrorAudioFormat *> *)values __attribute__((swift_name("values()")));
@property (class, readonly) NSArray<MirrorCoreMirrorAudioFormat *> *entries __attribute__((swift_name("entries")));
@property (readonly) NSString *wireName __attribute__((swift_name("wireName")));
@end

__attribute__((objc_subclassing_restricted))
__attribute__((swift_name("MirrorAudioFormat.Companion")))
@interface MirrorCoreMirrorAudioFormatCompanion : MirrorCoreBase
+ (instancetype)alloc __attribute__((unavailable));
+ (instancetype)allocWithZone:(struct _NSZone *)zone __attribute__((unavailable));
+ (instancetype)companion __attribute__((swift_name("init()")));
@property (class, readonly, getter=shared) MirrorCoreMirrorAudioFormatCompanion *shared __attribute__((swift_name("shared")));
- (MirrorCoreMirrorAudioFormat * _Nullable)fromWireNameWireName:(NSString *)wireName __attribute__((swift_name("fromWireName(wireName:)")));
@end

__attribute__((objc_subclassing_restricted))
__attribute__((swift_name("MirrorAvatarError")))
@interface MirrorCoreMirrorAvatarError : MirrorCoreBase
- (instancetype)initWithCode:(MirrorCoreMirrorAvatarErrorCode *)code message:(NSString *)message recoverable:(BOOL)recoverable nativeCode:(NSString * _Nullable)nativeCode __attribute__((swift_name("init(code:message:recoverable:nativeCode:)"))) __attribute__((objc_designated_initializer));
- (MirrorCoreMirrorAvatarError *)doCopyCode:(MirrorCoreMirrorAvatarErrorCode *)code message:(NSString *)message recoverable:(BOOL)recoverable nativeCode:(NSString * _Nullable)nativeCode __attribute__((swift_name("doCopy(code:message:recoverable:nativeCode:)")));
- (BOOL)isEqual:(id _Nullable)other __attribute__((swift_name("isEqual(_:)")));
- (NSUInteger)hash __attribute__((swift_name("hash()")));
- (NSString *)description __attribute__((swift_name("description()")));
@property (readonly) MirrorCoreMirrorAvatarErrorCode *code __attribute__((swift_name("code")));
@property (readonly) NSString *message __attribute__((swift_name("message")));
@property (readonly) NSString * _Nullable nativeCode __attribute__((swift_name("nativeCode")));
@property (readonly) BOOL recoverable __attribute__((swift_name("recoverable")));
@end

__attribute__((objc_subclassing_restricted))
__attribute__((swift_name("MirrorAvatarErrorCode")))
@interface MirrorCoreMirrorAvatarErrorCode : MirrorCoreKotlinEnum<MirrorCoreMirrorAvatarErrorCode *>
+ (instancetype)alloc __attribute__((unavailable));
+ (instancetype)allocWithZone:(struct _NSZone *)zone __attribute__((unavailable));
- (instancetype)initWithName:(NSString *)name ordinal:(int32_t)ordinal __attribute__((swift_name("init(name:ordinal:)"))) __attribute__((objc_designated_initializer)) __attribute__((unavailable));
@property (class, readonly, getter=companion) MirrorCoreMirrorAvatarErrorCodeCompanion *companion __attribute__((swift_name("companion")));
@property (class, readonly) MirrorCoreMirrorAvatarErrorCode *permissiondenied __attribute__((swift_name("permissiondenied")));
@property (class, readonly) MirrorCoreMirrorAvatarErrorCode *invalidconfig __attribute__((swift_name("invalidconfig")));
@property (class, readonly) MirrorCoreMirrorAvatarErrorCode *modelloadfailed __attribute__((swift_name("modelloadfailed")));
@property (class, readonly) MirrorCoreMirrorAvatarErrorCode *socketconnectionfailed __attribute__((swift_name("socketconnectionfailed")));
@property (class, readonly) MirrorCoreMirrorAvatarErrorCode *socketprotocolerror __attribute__((swift_name("socketprotocolerror")));
@property (class, readonly) MirrorCoreMirrorAvatarErrorCode *audiocapturefailed __attribute__((swift_name("audiocapturefailed")));
@property (class, readonly) MirrorCoreMirrorAvatarErrorCode *audioplaybackfailed __attribute__((swift_name("audioplaybackfailed")));
@property (class, readonly) MirrorCoreMirrorAvatarErrorCode *rendererfailed __attribute__((swift_name("rendererfailed")));
@property (class, readonly) MirrorCoreMirrorAvatarErrorCode *unknown __attribute__((swift_name("unknown")));
+ (MirrorCoreKotlinArray<MirrorCoreMirrorAvatarErrorCode *> *)values __attribute__((swift_name("values()")));
@property (class, readonly) NSArray<MirrorCoreMirrorAvatarErrorCode *> *entries __attribute__((swift_name("entries")));
@property (readonly) NSString *wireName __attribute__((swift_name("wireName")));
@end

__attribute__((objc_subclassing_restricted))
__attribute__((swift_name("MirrorAvatarErrorCode.Companion")))
@interface MirrorCoreMirrorAvatarErrorCodeCompanion : MirrorCoreBase
+ (instancetype)alloc __attribute__((unavailable));
+ (instancetype)allocWithZone:(struct _NSZone *)zone __attribute__((unavailable));
+ (instancetype)companion __attribute__((swift_name("init()")));
@property (class, readonly, getter=shared) MirrorCoreMirrorAvatarErrorCodeCompanion *shared __attribute__((swift_name("shared")));
- (MirrorCoreMirrorAvatarErrorCode * _Nullable)fromWireNameWireName:(NSString *)wireName __attribute__((swift_name("fromWireName(wireName:)")));
@end

__attribute__((objc_subclassing_restricted))
__attribute__((swift_name("MirrorAvatarState")))
@interface MirrorCoreMirrorAvatarState : MirrorCoreKotlinEnum<MirrorCoreMirrorAvatarState *>
+ (instancetype)alloc __attribute__((unavailable));
+ (instancetype)allocWithZone:(struct _NSZone *)zone __attribute__((unavailable));
- (instancetype)initWithName:(NSString *)name ordinal:(int32_t)ordinal __attribute__((swift_name("init(name:ordinal:)"))) __attribute__((objc_designated_initializer)) __attribute__((unavailable));
@property (class, readonly, getter=companion) MirrorCoreMirrorAvatarStateCompanion *companion __attribute__((swift_name("companion")));
@property (class, readonly) MirrorCoreMirrorAvatarState *idle __attribute__((swift_name("idle")));
@property (class, readonly) MirrorCoreMirrorAvatarState *connecting __attribute__((swift_name("connecting")));
@property (class, readonly) MirrorCoreMirrorAvatarState *ready __attribute__((swift_name("ready")));
@property (class, readonly) MirrorCoreMirrorAvatarState *listening __attribute__((swift_name("listening")));
@property (class, readonly) MirrorCoreMirrorAvatarState *thinking __attribute__((swift_name("thinking")));
@property (class, readonly) MirrorCoreMirrorAvatarState *speaking __attribute__((swift_name("speaking")));
@property (class, readonly) MirrorCoreMirrorAvatarState *interrupted __attribute__((swift_name("interrupted")));
@property (class, readonly) MirrorCoreMirrorAvatarState *stopped __attribute__((swift_name("stopped")));
@property (class, readonly) MirrorCoreMirrorAvatarState *error __attribute__((swift_name("error")));
+ (MirrorCoreKotlinArray<MirrorCoreMirrorAvatarState *> *)values __attribute__((swift_name("values()")));
@property (class, readonly) NSArray<MirrorCoreMirrorAvatarState *> *entries __attribute__((swift_name("entries")));
@property (readonly) NSString *wireName __attribute__((swift_name("wireName")));
@end

__attribute__((objc_subclassing_restricted))
__attribute__((swift_name("MirrorAvatarState.Companion")))
@interface MirrorCoreMirrorAvatarStateCompanion : MirrorCoreBase
+ (instancetype)alloc __attribute__((unavailable));
+ (instancetype)allocWithZone:(struct _NSZone *)zone __attribute__((unavailable));
+ (instancetype)companion __attribute__((swift_name("init()")));
@property (class, readonly, getter=shared) MirrorCoreMirrorAvatarStateCompanion *shared __attribute__((swift_name("shared")));
- (MirrorCoreMirrorAvatarState * _Nullable)fromWireNameWireName:(NSString *)wireName __attribute__((swift_name("fromWireName(wireName:)")));
@end

__attribute__((objc_subclassing_restricted))
__attribute__((swift_name("MirrorBlendshapeFrame")))
@interface MirrorCoreMirrorBlendshapeFrame : MirrorCoreBase
- (instancetype)initWithProtocolVersion:(int32_t)protocolVersion sessionId:(NSString *)sessionId responseId:(NSString *)responseId sequence:(int64_t)sequence audioTimeMs:(int64_t)audioTimeMs blendshapes:(NSDictionary<MirrorCoreMirrorBlendshapeName *, MirrorCoreDouble *> *)blendshapes __attribute__((swift_name("init(protocolVersion:sessionId:responseId:sequence:audioTimeMs:blendshapes:)"))) __attribute__((objc_designated_initializer));
- (MirrorCoreMirrorBlendshapeFrame *)doCopyProtocolVersion:(int32_t)protocolVersion sessionId:(NSString *)sessionId responseId:(NSString *)responseId sequence:(int64_t)sequence audioTimeMs:(int64_t)audioTimeMs blendshapes:(NSDictionary<MirrorCoreMirrorBlendshapeName *, MirrorCoreDouble *> *)blendshapes __attribute__((swift_name("doCopy(protocolVersion:sessionId:responseId:sequence:audioTimeMs:blendshapes:)")));
- (BOOL)isEqual:(id _Nullable)other __attribute__((swift_name("isEqual(_:)")));
- (NSUInteger)hash __attribute__((swift_name("hash()")));
- (MirrorCoreMirrorBlendshapeFrame *)normalized __attribute__((swift_name("normalized()")));
- (NSString *)description __attribute__((swift_name("description()")));
@property (readonly) int64_t audioTimeMs __attribute__((swift_name("audioTimeMs")));
@property (readonly) NSDictionary<MirrorCoreMirrorBlendshapeName *, MirrorCoreDouble *> *blendshapes __attribute__((swift_name("blendshapes")));
@property (readonly) int32_t protocolVersion __attribute__((swift_name("protocolVersion")));
@property (readonly) NSString *responseId __attribute__((swift_name("responseId")));
@property (readonly) int64_t sequence __attribute__((swift_name("sequence")));
@property (readonly) NSString *sessionId __attribute__((swift_name("sessionId")));
@end

__attribute__((objc_subclassing_restricted))
__attribute__((swift_name("MirrorBlendshapeName")))
@interface MirrorCoreMirrorBlendshapeName : MirrorCoreKotlinEnum<MirrorCoreMirrorBlendshapeName *>
+ (instancetype)alloc __attribute__((unavailable));
+ (instancetype)allocWithZone:(struct _NSZone *)zone __attribute__((unavailable));
- (instancetype)initWithName:(NSString *)name ordinal:(int32_t)ordinal __attribute__((swift_name("init(name:ordinal:)"))) __attribute__((objc_designated_initializer)) __attribute__((unavailable));
@property (class, readonly, getter=companion) MirrorCoreMirrorBlendshapeNameCompanion *companion __attribute__((swift_name("companion")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *browdownleft __attribute__((swift_name("browdownleft")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *browdownright __attribute__((swift_name("browdownright")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *browinnerup __attribute__((swift_name("browinnerup")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *browouterupleft __attribute__((swift_name("browouterupleft")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *browouterupright __attribute__((swift_name("browouterupright")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *cheekpuff __attribute__((swift_name("cheekpuff")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *cheeksquintleft __attribute__((swift_name("cheeksquintleft")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *cheeksquintright __attribute__((swift_name("cheeksquintright")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *eyeblinkleft __attribute__((swift_name("eyeblinkleft")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *eyeblinkright __attribute__((swift_name("eyeblinkright")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *eyelookdownleft __attribute__((swift_name("eyelookdownleft")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *eyelookdownright __attribute__((swift_name("eyelookdownright")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *eyelookinleft __attribute__((swift_name("eyelookinleft")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *eyelookinright __attribute__((swift_name("eyelookinright")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *eyelookoutleft __attribute__((swift_name("eyelookoutleft")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *eyelookoutright __attribute__((swift_name("eyelookoutright")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *eyelookupleft __attribute__((swift_name("eyelookupleft")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *eyelookupright __attribute__((swift_name("eyelookupright")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *eyesquintleft __attribute__((swift_name("eyesquintleft")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *eyesquintright __attribute__((swift_name("eyesquintright")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *eyewideleft __attribute__((swift_name("eyewideleft")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *eyewideright __attribute__((swift_name("eyewideright")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *jawforward __attribute__((swift_name("jawforward")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *jawleft __attribute__((swift_name("jawleft")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *jawopen __attribute__((swift_name("jawopen")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *jawright __attribute__((swift_name("jawright")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *mouthclose __attribute__((swift_name("mouthclose")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *mouthdimpleleft __attribute__((swift_name("mouthdimpleleft")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *mouthdimpleright __attribute__((swift_name("mouthdimpleright")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *mouthfrownleft __attribute__((swift_name("mouthfrownleft")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *mouthfrownright __attribute__((swift_name("mouthfrownright")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *mouthfunnel __attribute__((swift_name("mouthfunnel")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *mouthleft __attribute__((swift_name("mouthleft")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *mouthlowerdownleft __attribute__((swift_name("mouthlowerdownleft")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *mouthlowerdownright __attribute__((swift_name("mouthlowerdownright")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *mouthpressleft __attribute__((swift_name("mouthpressleft")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *mouthpressright __attribute__((swift_name("mouthpressright")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *mouthpucker __attribute__((swift_name("mouthpucker")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *mouthright __attribute__((swift_name("mouthright")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *mouthrolllower __attribute__((swift_name("mouthrolllower")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *mouthrollupper __attribute__((swift_name("mouthrollupper")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *mouthshruglower __attribute__((swift_name("mouthshruglower")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *mouthshrugupper __attribute__((swift_name("mouthshrugupper")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *mouthsmileleft __attribute__((swift_name("mouthsmileleft")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *mouthsmileright __attribute__((swift_name("mouthsmileright")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *mouthstretchleft __attribute__((swift_name("mouthstretchleft")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *mouthstretchright __attribute__((swift_name("mouthstretchright")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *mouthupperupleft __attribute__((swift_name("mouthupperupleft")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *mouthupperupright __attribute__((swift_name("mouthupperupright")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *nosesneerleft __attribute__((swift_name("nosesneerleft")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *nosesneerright __attribute__((swift_name("nosesneerright")));
@property (class, readonly) MirrorCoreMirrorBlendshapeName *tongueout __attribute__((swift_name("tongueout")));
+ (MirrorCoreKotlinArray<MirrorCoreMirrorBlendshapeName *> *)values __attribute__((swift_name("values()")));
@property (class, readonly) NSArray<MirrorCoreMirrorBlendshapeName *> *entries __attribute__((swift_name("entries")));
@property (readonly) NSString *wireName __attribute__((swift_name("wireName")));
@end

__attribute__((objc_subclassing_restricted))
__attribute__((swift_name("MirrorBlendshapeName.Companion")))
@interface MirrorCoreMirrorBlendshapeNameCompanion : MirrorCoreBase
+ (instancetype)alloc __attribute__((unavailable));
+ (instancetype)allocWithZone:(struct _NSZone *)zone __attribute__((unavailable));
+ (instancetype)companion __attribute__((swift_name("init()")));
@property (class, readonly, getter=shared) MirrorCoreMirrorBlendshapeNameCompanion *shared __attribute__((swift_name("shared")));
- (MirrorCoreMirrorBlendshapeName * _Nullable)fromWireNameWireName:(NSString *)wireName __attribute__((swift_name("fromWireName(wireName:)")));
@end

__attribute__((objc_subclassing_restricted))
__attribute__((swift_name("MirrorLatencyMetrics")))
@interface MirrorCoreMirrorLatencyMetrics : MirrorCoreBase
- (instancetype)initWithNetworkMs:(MirrorCoreLong * _Nullable)networkMs audioBufferMs:(MirrorCoreLong * _Nullable)audioBufferMs renderDriftMs:(MirrorCoreLong * _Nullable)renderDriftMs __attribute__((swift_name("init(networkMs:audioBufferMs:renderDriftMs:)"))) __attribute__((objc_designated_initializer));
- (MirrorCoreMirrorLatencyMetrics *)doCopyNetworkMs:(MirrorCoreLong * _Nullable)networkMs audioBufferMs:(MirrorCoreLong * _Nullable)audioBufferMs renderDriftMs:(MirrorCoreLong * _Nullable)renderDriftMs __attribute__((swift_name("doCopy(networkMs:audioBufferMs:renderDriftMs:)")));
- (BOOL)isEqual:(id _Nullable)other __attribute__((swift_name("isEqual(_:)")));
- (NSUInteger)hash __attribute__((swift_name("hash()")));
- (NSString *)description __attribute__((swift_name("description()")));
@property (readonly) MirrorCoreLong * _Nullable audioBufferMs __attribute__((swift_name("audioBufferMs")));
@property (readonly) MirrorCoreLong * _Nullable networkMs __attribute__((swift_name("networkMs")));
@property (readonly) MirrorCoreLong * _Nullable renderDriftMs __attribute__((swift_name("renderDriftMs")));
@end

__attribute__((objc_subclassing_restricted))
__attribute__((swift_name("MirrorProtocolIssue")))
@interface MirrorCoreMirrorProtocolIssue : MirrorCoreBase
- (instancetype)initWithField:(NSString *)field message:(NSString *)message __attribute__((swift_name("init(field:message:)"))) __attribute__((objc_designated_initializer));
- (MirrorCoreMirrorProtocolIssue *)doCopyField:(NSString *)field message:(NSString *)message __attribute__((swift_name("doCopy(field:message:)")));
- (BOOL)isEqual:(id _Nullable)other __attribute__((swift_name("isEqual(_:)")));
- (NSUInteger)hash __attribute__((swift_name("hash()")));
- (NSString *)description __attribute__((swift_name("description()")));
@property (readonly) NSString *field __attribute__((swift_name("field")));
@property (readonly) NSString *message __attribute__((swift_name("message")));
@end

__attribute__((objc_subclassing_restricted))
__attribute__((swift_name("MirrorProtocolValidator")))
@interface MirrorCoreMirrorProtocolValidator : MirrorCoreBase
+ (instancetype)alloc __attribute__((unavailable));
+ (instancetype)allocWithZone:(struct _NSZone *)zone __attribute__((unavailable));
+ (instancetype)mirrorProtocolValidator __attribute__((swift_name("init()")));
@property (class, readonly, getter=shared) MirrorCoreMirrorProtocolValidator *shared __attribute__((swift_name("shared")));
- (NSArray<MirrorCoreMirrorProtocolIssue *> *)validateFrameFrame:(MirrorCoreMirrorBlendshapeFrame *)frame __attribute__((swift_name("validateFrame(frame:)")));
@end

__attribute__((objc_subclassing_restricted))
__attribute__((swift_name("MirrorSessionConfig")))
@interface MirrorCoreMirrorSessionConfig : MirrorCoreBase
- (instancetype)initWithProtocolVersion:(int32_t)protocolVersion assistantId:(NSString * _Nullable)assistantId userId:(NSString * _Nullable)userId locale:(NSString * _Nullable)locale audioInputFormat:(MirrorCoreMirrorAudioFormat *)audioInputFormat audioOutputFormat:(MirrorCoreMirrorAudioFormat *)audioOutputFormat inputSampleRate:(int32_t)inputSampleRate outputSampleRate:(int32_t)outputSampleRate metadata:(NSDictionary<NSString *, NSString *> *)metadata __attribute__((swift_name("init(protocolVersion:assistantId:userId:locale:audioInputFormat:audioOutputFormat:inputSampleRate:outputSampleRate:metadata:)"))) __attribute__((objc_designated_initializer));
- (MirrorCoreMirrorSessionConfig *)doCopyProtocolVersion:(int32_t)protocolVersion assistantId:(NSString * _Nullable)assistantId userId:(NSString * _Nullable)userId locale:(NSString * _Nullable)locale audioInputFormat:(MirrorCoreMirrorAudioFormat *)audioInputFormat audioOutputFormat:(MirrorCoreMirrorAudioFormat *)audioOutputFormat inputSampleRate:(int32_t)inputSampleRate outputSampleRate:(int32_t)outputSampleRate metadata:(NSDictionary<NSString *, NSString *> *)metadata __attribute__((swift_name("doCopy(protocolVersion:assistantId:userId:locale:audioInputFormat:audioOutputFormat:inputSampleRate:outputSampleRate:metadata:)")));
- (BOOL)isEqual:(id _Nullable)other __attribute__((swift_name("isEqual(_:)")));
- (NSUInteger)hash __attribute__((swift_name("hash()")));
- (NSString *)description __attribute__((swift_name("description()")));
@property (readonly) NSString * _Nullable assistantId __attribute__((swift_name("assistantId")));
@property (readonly) MirrorCoreMirrorAudioFormat *audioInputFormat __attribute__((swift_name("audioInputFormat")));
@property (readonly) MirrorCoreMirrorAudioFormat *audioOutputFormat __attribute__((swift_name("audioOutputFormat")));
@property (readonly) int32_t inputSampleRate __attribute__((swift_name("inputSampleRate")));
@property (readonly) NSString * _Nullable locale __attribute__((swift_name("locale")));
@property (readonly) NSDictionary<NSString *, NSString *> *metadata __attribute__((swift_name("metadata")));
@property (readonly) int32_t outputSampleRate __attribute__((swift_name("outputSampleRate")));
@property (readonly) int32_t protocolVersion __attribute__((swift_name("protocolVersion")));
@property (readonly) NSString * _Nullable userId __attribute__((swift_name("userId")));
@end

__attribute__((objc_subclassing_restricted))
__attribute__((swift_name("MirrorSessionStateMachine")))
@interface MirrorCoreMirrorSessionStateMachine : MirrorCoreBase
- (instancetype)initWithInitialState:(MirrorCoreMirrorAvatarState *)initialState __attribute__((swift_name("init(initialState:)"))) __attribute__((objc_designated_initializer));
- (BOOL)canTransitionToNextState:(MirrorCoreMirrorAvatarState *)nextState __attribute__((swift_name("canTransitionTo(nextState:)")));
- (void)reset __attribute__((swift_name("reset()")));
- (MirrorCoreMirrorStateTransition *)transitionToNextState:(MirrorCoreMirrorAvatarState *)nextState __attribute__((swift_name("transitionTo(nextState:)")));
@property (readonly) MirrorCoreMirrorAvatarState *state __attribute__((swift_name("state")));
@end

__attribute__((objc_subclassing_restricted))
__attribute__((swift_name("MirrorStateTransition")))
@interface MirrorCoreMirrorStateTransition : MirrorCoreBase
- (instancetype)initWithFrom:(MirrorCoreMirrorAvatarState *)from to:(MirrorCoreMirrorAvatarState *)to accepted:(BOOL)accepted reason:(NSString * _Nullable)reason __attribute__((swift_name("init(from:to:accepted:reason:)"))) __attribute__((objc_designated_initializer));
- (MirrorCoreMirrorStateTransition *)doCopyFrom:(MirrorCoreMirrorAvatarState *)from to:(MirrorCoreMirrorAvatarState *)to accepted:(BOOL)accepted reason:(NSString * _Nullable)reason __attribute__((swift_name("doCopy(from:to:accepted:reason:)")));
- (BOOL)isEqual:(id _Nullable)other __attribute__((swift_name("isEqual(_:)")));
- (NSUInteger)hash __attribute__((swift_name("hash()")));
- (NSString *)description __attribute__((swift_name("description()")));
@property (readonly) BOOL accepted __attribute__((swift_name("accepted")));
@property (readonly) MirrorCoreMirrorAvatarState *from __attribute__((swift_name("from")));
@property (readonly) NSString * _Nullable reason __attribute__((swift_name("reason")));
@property (readonly) MirrorCoreMirrorAvatarState *to __attribute__((swift_name("to")));
@end

@interface MirrorCoreMirrorBlendshapeFrame (Extensions)
- (MirrorCoreBlendshapePose *)toPose __attribute__((swift_name("toPose()")));
@end

__attribute__((objc_subclassing_restricted))
__attribute__((swift_name("MirrorProtocolKt")))
@interface MirrorCoreMirrorProtocolKt : MirrorCoreBase
@property (class, readonly) int32_t MirrorProtocolVersion __attribute__((swift_name("MirrorProtocolVersion")));
@end

__attribute__((objc_subclassing_restricted))
__attribute__((swift_name("KotlinEnumCompanion")))
@interface MirrorCoreKotlinEnumCompanion : MirrorCoreBase
+ (instancetype)alloc __attribute__((unavailable));
+ (instancetype)allocWithZone:(struct _NSZone *)zone __attribute__((unavailable));
+ (instancetype)companion __attribute__((swift_name("init()")));
@property (class, readonly, getter=shared) MirrorCoreKotlinEnumCompanion *shared __attribute__((swift_name("shared")));
@end

__attribute__((objc_subclassing_restricted))
__attribute__((swift_name("KotlinArray")))
@interface MirrorCoreKotlinArray<T> : MirrorCoreBase
+ (instancetype)arrayWithSize:(int32_t)size init:(T _Nullable (^)(MirrorCoreInt *))init __attribute__((swift_name("init(size:init:)")));
+ (instancetype)alloc __attribute__((unavailable));
+ (instancetype)allocWithZone:(struct _NSZone *)zone __attribute__((unavailable));
- (T _Nullable)getIndex:(int32_t)index __attribute__((swift_name("get(index:)")));
- (id<MirrorCoreKotlinIterator>)iterator __attribute__((swift_name("iterator()")));
- (void)setIndex:(int32_t)index value:(T _Nullable)value __attribute__((swift_name("set(index:value:)")));
@property (readonly) int32_t size __attribute__((swift_name("size")));
@end

__attribute__((swift_name("KotlinIterator")))
@protocol MirrorCoreKotlinIterator
@required
- (BOOL)hasNext __attribute__((swift_name("hasNext()")));
- (id _Nullable)next __attribute__((swift_name("next()")));
@end

#pragma pop_macro("_Nullable_result")
#pragma clang diagnostic pop
NS_ASSUME_NONNULL_END
