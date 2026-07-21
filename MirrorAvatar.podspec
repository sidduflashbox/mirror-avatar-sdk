require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name = 'MirrorAvatar'
  s.version = package['version']
  s.summary = package['description']
  s.description = 'React Native iOS module for the Mirror realtime avatar SDK: mic capture, audio playback, and lip-sync timing.'
  s.homepage = 'https://github.com/Mirrorr-AI/mirrorr-avatar-sdk-rn'
  s.license = { :type => 'UNLICENSED' }
  s.author = { 'Flashbox' => 'siddugh@flashbox.in' }
  s.platforms = { :ios => '15.0' }
  s.source = { :git => 'git@github.com:Mirrorr-AI/mirrorr-avatar-sdk-rn.git', :tag => s.version.to_s }
  s.source_files = 'ios/Sources/**/*.{h,m,mm,swift}'
  # Prebuilt, committed binary — consumers need no Kotlin/Gradle/JDK toolchain.
  s.vendored_frameworks = 'ios/Frameworks/MirrorCore.xcframework'
  s.swift_version = '5.10'
  s.requires_arc = true

  s.dependency 'React-Core'
end
