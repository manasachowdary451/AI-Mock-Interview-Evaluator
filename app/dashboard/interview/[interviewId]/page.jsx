"use client";
import { Button } from "@/components/ui/button";
import { db } from "@/utils/db";
import { MockInterview } from "@/utils/schema";
import { eq } from "drizzle-orm";
import { Lightbulb, WebcamIcon } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useState, useRef } from "react";
import Webcam from "react-webcam";
import { toast } from "sonner";
import * as faceDetection from "@mediapipe/face_detection";
import * as cam from "@mediapipe/camera_utils";
import * as faceapi from "face-api.js";


function Interview({ params }) {
  const [interviewData, setInterviewData] = useState(null);
  const [webCamEnabled, setWebCamEnabled] = useState(false);

    // Feedback states
  const [eyeContactScore, setEyeContactScore] = useState(0);
  const [voiceFeedback, setVoiceFeedback] = useState("");
  const [eyeFeedback, setEyeFeedback] = useState("");

  const webcamRef = useRef(null);
  const [faceapi, setFaceapi] = useState(null);

  // ✅ Load models once
  useEffect(() => {
    const loadFaceApi = async () => {
      const faceapiModule = await import("face-api.js"); // dynamic import
      setFaceapi(faceapiModule);

      await faceapiModule.nets.tinyFaceDetector.loadFromUri("/models");
      await faceapiModule.nets.faceLandmark68Net.loadFromUri("/models");
      await faceapiModule.nets.faceRecognitionNet.loadFromUri("/models");

      console.log("✅ Models loaded successfully");
    };

    loadFaceApi();
  }, []);

  // ✅ Fetch interview details
  useEffect(() => {
    GetInterviewDetails();
  }, []);

  const GetInterviewDetails = async () => {
    try {
      const result = await db
        .select()
        .from(MockInterview)
        .where(eq(MockInterview.mockId, params.interviewId));

      if (result.length > 0) {
        setInterviewData(result[0]);
      } else {
        toast.error("Interview details not found");
      }
    } catch (error) {
      toast.error("Error fetching interview details");
      console.error("Interview details fetch error:", error);
    }
  };

  // ✅ Face detection loop
  useEffect(() => {
  let interval;
  if (webCamEnabled && webcamRef.current) {
    interval = setInterval(async () => {
      const video = webcamRef.current.video;
      if (video && video.readyState === 4) {
        const detection = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({
            inputSize: 224,
            scoreThreshold: 0.5
          }))
          .withFaceLandmarks();

          if (detection) {
            const landmarks = detection.landmarks;
            const leftEye = landmarks.getLeftEye();
            const rightEye = landmarks.getRightEye();
            
            // Get average Y position of eyes
            const avgEyeY = (leftEye[0].y + rightEye[3].y) / 2;
            const faceBox = detection.detection.box;

            if (avgEyeY > faceBox.y + faceBox.height * 0.6) {
              setEyeFeedback("⚠️ You are looking down");
              setEyeContactScore(40);
            } else {
              setEyeFeedback("✅ Good eye contact!");
              setEyeContactScore(90);
            }
          } else {
            setEyeFeedback("❌ No face detected");
            setEyeContactScore(0);
          }
        }
    }, 1500);
  }
  return () => clearInterval(interval);
}, [webCamEnabled]);

  // ✅ Webcam toggle
  const handleWebcamToggle = async () => {
  if (!webCamEnabled) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setWebCamEnabled(true);
      toast.success("Webcam & Mic enabled");

      // ✅ Attach video stream
      if (webcamRef.current) {
        webcamRef.current.srcObject = stream;
      }

      // ✅ FACE DETECTION LOOP
      const runFaceDetection = async () => {
        if (webcamRef.current && webcamRef.current.readyState === 4) {
          const detections = await faceapi.detectSingleFace(
            webcamRef.current,
            new faceapi.TinyFaceDetectorOptions()
          ).withFaceLandmarks();

          if (detections) {
            // Example: Check if face is centered horizontally
            const { x, width } = detections.detection.box;
            const faceCenter = x + width / 2;
            const videoWidth = webcamRef.current.videoWidth;

            if (faceCenter > videoWidth * 0.3 && faceCenter < videoWidth * 0.7) {
              setEyeFeedback("✅ Good eye contact!");
              setEyeContactScore(90);
            } else {
              setEyeFeedback("⚠️ Position your face in the center");
              setEyeContactScore(40);
            }
          } else {
            setEyeFeedback("❌ No face detected");
            setEyeContactScore(0);
          }
        }
        requestAnimationFrame(runFaceDetection);
      };
      runFaceDetection();

      // ✅ VOICE DETECTION LOOP
      const audioCtx = new AudioContext();
      const mic = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      mic.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        let avg = dataArray.reduce((a, b) => a + b, 0) / bufferLength;

        if (avg > 40) {
          setVoiceFeedback("✅ Voice is clear");
        } else if (avg > 20 && avg <= 40) {
          setVoiceFeedback("🙂 Your voice was clear, but try to add more energy.");
        } else {
          setVoiceFeedback("⚠️ Speak louder");
        }

        requestAnimationFrame(checkVolume);
      };
      checkVolume();

    } catch (err) {
      toast.error("Failed to enable webcam/mic");
      console.error("Error:", err);
    }
  } else {
    setWebCamEnabled(false);
    setEyeContactScore(0);
    setVoiceFeedback("Pending analysis...");
    setEyeFeedback("⚠️ Position your face in the center");
  }
};

  if (!interviewData) {
    return <div>Loading interview details...</div>;
  }

  return (
    <div className="my-10">
      <h2 className="font-bold text-2xl">Let's get started</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="flex flex-col my-5 gap-5">
          <div className="flex flex-col p-5 rounded-lg border gap-5">
            <h2 className="text-lg">
              <strong>Job Role/Job Position: </strong>
              {interviewData.jobPosition}
            </h2>
            <h2 className="text-lg">
              <strong>Job Description/Tech Stack: </strong>
              {interviewData.jobDesc}
            </h2>
            <h2 className="text-lg">
              <strong>Years of Experience: </strong>
              {interviewData.jobExperience}
            </h2>
          </div>
          <div className="p-5 border rounded-lg border-yellow-300 bg-yellow-100">
            <h2 className="flex gap-2 items-center text-yellow-500">
              <Lightbulb />
              <span>Information</span>
            </h2>
            <h2 className="mt-3 text-yellow-500">
              Enable Video Web Cam and Microphone to Start your AI Generated Mock Interview. 
              It has 5 questions which you can answer and will provide a report based on your answers. 
              NOTE: We never record your video. Web cam access can be disabled at any time.
            </h2>
          </div>
        </div>
         {/* Webcam Section */}
        <div>
          {webCamEnabled ? (
            <Webcam
              ref={webcamRef}
              mirrored={true}
              style={{ height: 480, width: 640 }}
              onUserMedia={() => setWebCamEnabled(true)}
              onUserMediaError={() => {
                toast.error("Webcam access error");
                setWebCamEnabled(false);
              }}
            />
          ) : (
            <>
              <WebcamIcon className="h-72 my-7 border rounded-lg w-full p-20 bg-secondary" />
              <Button
                className="w-full"
                variant="ghost"
                onClick={handleWebcamToggle}
              >
                Enable Web Cam and Microphone
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Feedback Section */}
      <div className="mt-6 p-4 border rounded-lg bg-gray-50">
        <h3 className="font-semibold">📊 Feedback</h3>
        <p className="mt-2">
          👀 <strong>Eye Contact Score:</strong> {eyeContactScore}%
        </p>
        <p className="mt-2">
          🎤 <strong>Voice Feedback:</strong> {voiceFeedback || "Pending analysis..."}
        </p>
        <p className="mt-2">
          👁️ <strong>Eye Contact Feedback:</strong> {eyeFeedback || "Pending analysis..."}
        </p>
      </div>
      <div className="flex justify-end items-end">
        {eyeContactScore >= 60 && voiceFeedback.includes("⚠️") ? (
          <Link href={`/dashboard/interview/${params.interviewId}/start`}>
            <Button>Start Interview</Button>
          </Link>
        ) : (
          <Button disabled>Start Interview</Button>
        )}
      </div>
    </div>
  );
}

export default Interview;