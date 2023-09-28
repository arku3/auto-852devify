'use client';

import { HTMLAttributes, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as faceapi from 'face-api.js';
import { atom, useAtomValue, useSetAtom } from 'jotai';
import jsFileDownload from 'js-file-download';
import { DownloadIcon, Loader2Icon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface FileInputFormData {
  files: File[];
}

const ImageAtom = atom<{ uri: string | null; minConfidence: number }>({ uri: null, minConfidence: 0.3 });

const FileInputForm = () => {
  const setImageAtom = useSetAtom(ImageAtom);
  const { handleSubmit, register } = useForm({
    defaultValues: {
      files: [],
    } as FileInputFormData,
  });
  const onSubmit = ({ files }: FileInputFormData) => {
    // console.log(files);
    if (files.length === 0) {
      return;
    }
    setImageAtom((prev) => ({ ...prev, uri: URL.createObjectURL(files[0]) }));
  };

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle>Auto-Nounify your pictures!</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-row items-center gap-2">
            <Input {...register('files')} type="file" id="files" accept=".jpg,.jpeg,.png" />
            <Button type="submit">Nounify</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

function FaceDetection() {
  const { uri, minConfidence } = useAtomValue(ImageAtom);
  const { data: net } = useQuery({
    queryKey: ['face-api'],
    queryFn: async () => {
      await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
      await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
      return true;
    },
    staleTime: Infinity,
  });
  const enabled = !!uri && !!net;
  const { data: detections } = useQuery({
    queryKey: ['face-api', 'detect', uri, minConfidence],
    queryFn: async () => {
      const imageElement = document.createElement('img');
      imageElement.src = uri as string;
      const detections = await faceapi
        .detectAllFaces(imageElement, new faceapi.SsdMobilenetv1Options({ minConfidence }))
        .withFaceLandmarks();
      // console.log({ detections });
      return detections ?? [];
    },
    enabled,
  });

  return (
    <div className="relative mx-auto grid h-auto max-w-lg items-center justify-center">
      {!net || (enabled && !detections) ? <Loader2Icon className="h-6 w-6 animate-spin" /> : null}
      <OutputCanvas detections={detections} baseImageUri={uri} className="h-auto max-w-full" key={`${uri}`} />
    </div>
  );
}

function middlePoint(points: faceapi.Point[]) {
  const x = points.reduce((acc, curr) => acc + curr.x, 0) / points.length;
  const y = points.reduce((acc, curr) => acc + curr.y, 0) / points.length;
  return { x, y };
}
function drawRotatedImage(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  x: number,
  y: number,
  width: number,
  height: number,
  angle: number
) {
  // save the current co-ordinate system
  // before we screw with it
  context.save();

  // move to the middle of where we want to draw our image
  context.translate(x, y);

  // rotate around that point, converting our
  // angle from degrees to radians
  // context.rotate(angle * TO_RADIANS);
  context.rotate(angle);

  // draw it up and to the left by half the width
  // and height of the image
  context.drawImage(image, -(width / 2), -(height / 2), width, height);

  // and restore the coords to how they were when we began
  context.restore();
}

function OutputCanvas({
  baseImageUri,
  detections,
  ...props
}: HTMLAttributes<HTMLCanvasElement> & {
  baseImageUri: string | null;
  detections?: faceapi.WithFaceLandmarks<{
    detection: faceapi.FaceDetection;
  }>[];
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!window || !detections || !detections.length || !baseImageUri) {
      return;
    }
    setReady(false);
    const t = setTimeout(() => {
      // console.log('inTimeout');
      if (!ref.current) {
        return;
      }
      const context = ref.current.getContext('2d', { willReadFrequently: true });
      if (!context) {
        return;
      }

      const bgImage = document.createElement('img');
      bgImage.src = baseImageUri;
      const glasses = document.createElement('img');
      glasses.src = '/glasses-red.png';
      ref.current.height = bgImage.height;
      ref.current.width = bgImage.width;

      context.drawImage(bgImage, 0, 0);
      try {
        for (const face of detections) {
          const scaleFactor = 2.7;
          const leftEye = middlePoint(face.landmarks.getLeftEye());
          const rightEye = middlePoint(face.landmarks.getRightEye());
          const width = Math.abs(leftEye.x - rightEye.x) * scaleFactor;
          const height = Math.abs((width * 80) / 150); // the red-glasses image is 150x80
          console.log({ width, height, leftEye, rightEye });

          const dx = rightEye.x - leftEye.x;
          const dy = rightEye.y - leftEye.y;
          const angle = Math.atan2(dy, dx);

          // console.log(width, height, leftEye, rightEye);
          // context.drawImage(glasses, leftEye.x - width / 3, leftEye.y - height / 2, width, height);
          drawRotatedImage(context, glasses, leftEye.x, leftEye.y, width, height, angle);
        }
        setReady(true);
      } catch (e) {
        console.log(e);
      }
    }, 100);

    return () => clearTimeout(t);
  }, [ref, detections, baseImageUri]);

  return (
    <>
      <canvas ref={ref} {...props} />
      <div className="p-4">
        {baseImageUri && detections && (
          <Button
            onClick={async () => {
              if (ref.current) {
                const response = await fetch(ref.current.toDataURL('image/png'));
                jsFileDownload(await response.blob(), 'nounified.png');
              }
            }}
            disabled={!ready}
          >
            <DownloadIcon className="mr-2 h-6 w-6" />
            Save
          </Button>
        )}
      </div>
      {baseImageUri && detections && !ready ? <div className="absolute inset-0 z-10 bg-black/50" /> : null}
    </>
  );
}

export { FileInputForm, FaceDetection };
