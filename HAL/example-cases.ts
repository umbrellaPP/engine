import { IAudioPlayer, Image, Application } from 'HAL';


Audio.load('http://aa.mp3').then(async audio => {
    await audio.play();
});

(async function () {
    let audio = await Audio.load('http://tet.mp3');
    await audio.play();
})()

    
