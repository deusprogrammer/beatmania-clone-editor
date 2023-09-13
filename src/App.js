import { useEffect, useRef, useState } from 'react';
import songChart from './chart';
import WaveSurfer from 'wavesurfer.js';
import './App.css';


let ctx;
let audioSource;

let interval;
let startedAt;
let skipNextScrollEvent = false;

const App = () => {
    const [audioBuffer, setAudioBuffer] = useState(null);
    const [audioBase64, setAudioBase64] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);

    const [chart, setChart] = useState([]);
    const [bpm, setBpm] = useState(120);

    const editorWindow = useRef();

    useEffect(() => {
        if (!audioBuffer) {
            return;
        }

        setChart(songChart);

        if (!audioBase64) {
            return;
        }

        let wavesurfer = WaveSurfer.create({
            container: document.getElementById('audio-canvas'),
            waveColor: '#4F4A85',
            progressColor: '#4F4A85',
            vertical: true,
        });

        wavesurfer.load(audioBase64);
    }, [audioBuffer, audioBase64]);

    const onFileLoad = (event) => {
        setIsLoading(true);
        let fr = new FileReader();
        let frBase64 = new FileReader();
        let file = event.target.files[0];
        
        fr.addEventListener("load", async ({target: {result}}) => {
            ctx = new AudioContext();
            let audioBuffer = await ctx.decodeAudioData(result);
            setAudioBuffer(audioBuffer);
            setIsLoading(false);
        });

        frBase64.addEventListener("load", async ({target: {result}}) => {
            setAudioBase64(result);
        });

        fr.readAsArrayBuffer(file);
        frBase64.readAsDataURL(file);
    }

    const onPlay = () => {
        const el = document.getElementById('editorWindow');
        const scrollValue = parseInt(el.scrollTop) / (parseInt(el.scrollHeight));

        if (audioSource) {
            audioSource.stop(0);
        }
        audioSource = ctx.createBufferSource();
        audioSource.buffer = audioBuffer;
        audioSource.connect(ctx.destination);
        audioSource.start(0, scrollValue * audioBuffer.duration);
    
        if (interval) {
            clearInterval(interval);
        }

        startedAt = ctx.currentTime - (scrollValue * audioBuffer.duration);

        setIsPlaying(true);

        interval = setInterval(() => {
            try {
                const el = document.getElementById('editorWindow');
                setScrollTop(((ctx.currentTime - startedAt)/audioBuffer.duration) * (el.scrollHeight));
            } catch (e) {
                console.error(e);
            }
        }, 1/60);
    }

    const onPause = () => {
        if (audioSource) {
            audioSource.stop(0);
        }

        setIsPlaying(false);

        if (interval) {
            clearInterval(interval);
        }
    }

    const onScroll = () => {
        if (skipNextScrollEvent) {
            skipNextScrollEvent = false;
            return;
        }

        if (interval) {
            clearInterval(interval);
        }
        setIsPlaying(false);
        
        const el = document.getElementById('editorWindow');
        const scrollValue = parseInt(el.scrollTop) / (parseInt(el.scrollHeight));

        if (audioSource) {
            audioSource.stop(0);
        }
        audioSource = ctx.createBufferSource();
        audioSource.buffer = audioBuffer;
        audioSource.connect(ctx.destination);
        const offset = scrollValue * audioBuffer.duration;
        const duration = 0.1;
        audioSource.start(0, offset, duration);
        startedAt = ctx.currentTime - offset;

        // onPlay();
    }

    const setScrollTop = (value) => {
        skipNextScrollEvent = true;
        const el = document.getElementById('editorWindow');
        el.scrollTop = value;
    }

    const placeBeat = (event) => {
        let {top, bottom} = editorWindow.current.getBoundingClientRect();
        let x = event.clientX;
        let ms = (event.clientY - (top + editorWindow.current.scrollTop) - (bottom - top) / 2) * -1;
        let column = Math.trunc(x/128);

        console.log(`${column}@${ms}ms`);

        if (column > 4) {
            return;
        }

        let index = Math.trunc(ms/1000);
        let chartCopy = [...chart];
        chartCopy[index] = [...chart[index]];
        chartCopy[index].push({
            column,
            ms
        });

        setChart(chartCopy);
    }

    const createLineTimings = (bpm, duration) => {
        let lineTimings = [];
        let bps = bpm / 60;
        for (let beat = 0; beat < Math.ceil(bpm * duration/60); beat++) {
            for (let i = 0; i < 16; i++) {
                let color;
                switch (i) {
                    case 0:
                        color = '#ffff00';
                        break;
                    case 8:
                        color = '#00ff00';
                        break;
                    case 4:
                    case 12:
                        color = '#00ffff';
                        break;
                    default:
                        color = '#ff00ff';
                }
                lineTimings.push({
                    ms: beat * (1000 / bps) + i * (1000 / bps / 16),
                    color,
                });
            }
        }

        console.log(JSON.stringify(lineTimings, null, 5));

        return lineTimings;
    }

    let lines = [];

    if (audioBuffer) {
        lines = createLineTimings(bpm, audioBuffer.duration);
    }

    return <div style={{backgroundColor: 'black', color: 'white'}}>
        <div>
            <div style={{height: '44px'}}>
                <input type='file' onChange={onFileLoad} disabled={audioBuffer} />
                <label>BPM</label><input type='number' onChange={({target: {value}}) => {setBpm(value)}} value={bpm} />
                {isLoading ? <div>Loading Audio...</div> : null}
                <br />
                {audioBuffer ? 
                    <>
                        {isPlaying ? <button onClick={onPause}>Pause</button> : <button onClick={onPlay}>Play</button>}
                    </>: 
                    null}
            </div>
            {audioBuffer ? <div id="editorWindow" style={{position: 'relative', height: 'calc(100vh - 42px)', width: '100vw', overflowY: 'scroll', overflowX: 'hidden', transform: 'scaleY(-1)'}} ref={editorWindow} onScroll={onScroll} onClick={onPause}>
                <div style={{height: `${Math.trunc(audioBuffer.duration * 1000)}px`}} onMouseDown={placeBeat}>
                    {chart.map((second) => {
                        if (!second) {
                            return null;
                        }
                        return second.map(({column, ms, end}) => {
                            return <div key={`${column}-${ms}`} style={{position: 'absolute', width: '128px', height: end ? `${end - ms}px` : '32px', top: `calc(${ms}px + 50% - 16px)`, left: column * 128 + 'px', backgroundColor: end ? 'blue' : 'red'}} />
                        });
                    })}
                    {lines.map(({ms, color}) => {
                        return <div key={`line-${ms}`} style={{position: 'absolute', width: `${128 * 5}px`, height: 1, top: `calc(${ms}px + 50%)`, left: '0px', backgroundColor: color}} />
                    })}
                </div>
                <div id='audio-canvas' style={{display: 'flex', position: 'absolute', top: 'calc(50% - 44px)', right: '0px', width: '200px', height: `${Math.trunc(audioBuffer.duration * 1000)}px`}} />
            </div> : null}
            <div style={{position: 'fixed', backgroundColor: 'white', height: '1px', width: '100%', top: 'calc(100vh - 50% + 22px)', left: '0px'}} />
        </div>
    </div>
}

export default App;
