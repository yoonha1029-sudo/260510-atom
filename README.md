# Atom & Ion Representation Research App

학생의 원자 및 이온 개념 표상을 그림과 글로 수집하기 위한
웹 기반 연구 도구입니다.

## Overview

본 웹앱은 학생이 제시된 과학 개념을
그림과 텍스트로 표현할 수 있도록 설계되었습니다.

### Tasks

1. 탄소 원자 모형
2. 리튬 원자에서 리튬 이온으로의 변화
3. 전기장 내 이온의 이동

## Architecture

GitHub Pages
    ↓
Google Apps Script
    ├── Google Sheets
    └── Google Drive

## Project Structure

/
├── index.html
├── style.css
├── script.js
├── assets/
│   ├── pic2.png
│   └── pic3.png
└── README.md

## Data Flow

1. 학생 정보 입력
2. 문항별 그림 및 텍스트 작성
3. 응답 데이터 생성
4. Google Apps Script로 전송
5. 텍스트/메타데이터 → Google Sheets
6. 그림 → Google Drive

## Development

### Local

...

### Test deployment

GitHub Pages ...

## Environments

- Development
- Test
- Production

## Data & Privacy

연구 데이터 및 개인정보는 GitHub 저장소에 저장하지 않습니다.
GitHub Pages는 사용자 인터페이스 제공에만 사용합니다.

## Version

Research pilot: v0.x
Main study: v1.0.0

## License / Research Notice

Research use only.
